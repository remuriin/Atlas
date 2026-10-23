// Counts how many sets of flashcards each user has made, for the daily limit.
// One document per user in "flashcardUsage": when the 24-hour window started,
// and how many turns were used in it. Kept in the database (not in memory) so the
// count survives the server restarting.
const { db } = require('../config/firebase');

const usageCollection = db.collection('flashcardUsage');

// Uses up one turn if there is one left. Resolves with true when the turn was
// taken, or false when the limit is already reached.
const takeTurn = async (userId, limit, windowMilliseconds) => {
  const ref = usageCollection.doc(String(userId));
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();

    // No turns used yet, or the last window is over: start a fresh window.
    if (!doc.exists || now - doc.get('windowStart').toMillis() >= windowMilliseconds) {
      transaction.set(ref, { windowStart: new Date(now), count: 1 });
      return true;
    }
    if (doc.get('count') >= limit) {
      return false;
    }
    transaction.update(ref, { count: doc.get('count') + 1 });
    return true;
  });
};

// Gives a turn back, for an attempt that failed (failed attempts do not count).
const giveBackTurn = async (userId) => {
  const ref = usageCollection.doc(String(userId));
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (doc.exists && doc.get('count') > 0) {
      transaction.update(ref, { count: doc.get('count') - 1 });
    }
  });
};

module.exports = {
  takeTurn: takeTurn,
  giveBackTurn: giveBackTurn,
};
