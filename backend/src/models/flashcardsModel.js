// All database code for flashcards lives in this file.
// Each card is one document in the "flashcards" collection, named after its number,
// and remembers which saved item it belongs to.
const { db } = require('../config/firebase');
const countersModel = require('./countersModel');

const cardsCollection = db.collection('flashcards');

const toCardRow = (doc) => {
  const data = doc.data();
  return {
    id: Number(doc.id),
    position: data.position,
    front: data.front,
    back: data.back,
    status: data.status,
  };
};

const listFlashcards = async (savedItemId) => {
  // List the cards of one saved item in the order they were made.
  const snapshot = await cardsCollection.where('savedItemId', '==', savedItemId).get();
  const cards = snapshot.docs.map(toCardRow);
  cards.sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.id - b.id;
  });
  return cards;
};

const replaceFlashcards = async (savedItemId, cards) => {
  // Swap the old set for a new one. The transaction makes it all-or-nothing:
  // if anything fails, the old cards are kept instead of a half-made set.
  // (At most 100 old and 100 new cards: well inside Firestore's 500 writes per transaction.)
  const savedRef = db.collection('savedItems').doc(String(savedItemId));
  const oldCardsQuery = cardsCollection.where('savedItemId', '==', savedItemId);

  await db.runTransaction(async (transaction) => {
    const oldCards = await transaction.get(oldCardsQuery);
    const firstId = await countersModel.takeIds(transaction, 'flashcards', cards.length);

    oldCards.docs.forEach((doc) => {
      transaction.delete(doc.ref);
    });
    const now = new Date();
    cards.forEach((card, index) => {
      transaction.set(cardsCollection.doc(String(firstId + index)), {
        savedItemId: savedItemId,
        position: index + 1,
        front: card.front,
        back: card.back,
        status: 'new',
        createdAt: now,
      });
    });
    transaction.update(savedRef, { flashcardCount: cards.length });
  });
};

const deleteFlashcardsForItem = async (savedItemId) => {
  // Remove every card of one saved item.
  const savedRef = db.collection('savedItems').doc(String(savedItemId));
  const snapshot = await cardsCollection.where('savedItemId', '==', savedItemId).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  batch.update(savedRef, { flashcardCount: 0 });
  await batch.commit();
};

const updateFlashcardStatus = async (cardId, savedItemId, status) => {
  // Change how well a card is known. Checking savedItemId too means a card can
  // only be changed through the saved item it belongs to.
  const ref = cardsCollection.doc(String(cardId));
  const doc = await ref.get();
  if (!doc.exists || doc.get('savedItemId') !== savedItemId) {
    return null;
  }
  await ref.update({ status: status });
  const updated = toCardRow(doc);
  updated.status = status;
  return updated;
};

module.exports = {
  listFlashcards: listFlashcards,
  replaceFlashcards: replaceFlashcards,
  deleteFlashcardsForItem: deleteFlashcardsForItem,
  updateFlashcardStatus: updateFlashcardStatus,
};
