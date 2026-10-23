// Request handlers for a user's saved study reviewers: notes and flashcards.
// loadSavedItem has already checked that req.saved belongs to the logged-in user.
const savedItemsModel = require('../models/savedItemsModel');
const flashcardsModel = require('../models/flashcardsModel');
const validate = require('../utils/validate');
const reviewerItems = require('../utils/reviewerItems');
const materialContent = require('../utils/materialContent');
const gemini = require('../utils/gemini');
const createHttpError = require('../utils/httpError');

const toCardJson = (card) => {
  return { id: card.id, front: card.front, back: card.back, status: card.status };
};

// GET /api/saved/:savedId   (the notes are only ever sent to their owner)
const getSavedItem = (req, res) => {
  const item = reviewerItems.toSavedJson(req.saved);
  item.notes = req.saved.notes;
  // 'text' for notes written before formatting existed, 'html' for everything since.
  item.notesFormat = req.saved.notes_format;
  res.json(item);
};

// DELETE /api/saved/:savedId
const deleteSavedItem = async (req, res, next) => {
  try {
    await savedItemsModel.deleteSavedItem(req.saved.id);
    res.json({ deleted: true, id: req.saved.id });
  } catch (err) {
    next(err);
  }
};

// PUT /api/saved/:savedId/notes
const updateNotes = async (req, res, next) => {
  try {
    const body = req.body || {};
    const notes = validate.validateNotes(body.notes);
    const updated = await savedItemsModel.updateNotes(req.saved.id, notes);
    res.json({
      notes: updated.notes,
      notesFormat: updated.notes_format,
      notesUpdatedAt: updated.notes_updated_at,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/saved/:savedId/flashcards
const listFlashcards = async (req, res, next) => {
  try {
    const cards = await flashcardsModel.listFlashcards(req.saved.id);
    res.json({ cards: cards.map(toCardJson) });
  } catch (err) {
    next(err);
  }
};

// POST /api/saved/:savedId/flashcards   (replaces any cards made before)
const createFlashcards = async (req, res, next) => {
  try {
    const body = req.body || {};
    const count = validate.validateFlashcardCount(body.count);

    // The cards are made from the original file, so it has to still exist.
    if (req.saved.live_reviewer_id === null) {
      throw createHttpError(
        409,
        'The original study reviewer was removed, so new flashcards cannot be made from it.'
      );
    }

    const parts = await materialContent.buildMaterialParts(req.saved);
    const newCards = await gemini.generateFlashcards(parts, count);
    await flashcardsModel.replaceFlashcards(req.saved.id, newCards);

    const cards = await flashcardsModel.listFlashcards(req.saved.id);
    res.status(201).json({ cards: cards.map(toCardJson) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/saved/:savedId/flashcards
const deleteFlashcards = async (req, res, next) => {
  try {
    await flashcardsModel.deleteFlashcardsForItem(req.saved.id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

// PUT /api/saved/:savedId/flashcards/:cardId
const updateFlashcardStatus = async (req, res, next) => {
  try {
    const cardId = validate.parseId(req.params.cardId);
    if (cardId === null) {
      throw createHttpError(400, 'That flashcard id is not valid.');
    }
    const body = req.body || {};
    const status = validate.validateFlashcardStatus(body.status);

    const card = await flashcardsModel.updateFlashcardStatus(cardId, req.saved.id, status);
    if (!card) {
      throw createHttpError(404, 'That flashcard could not be found.');
    }
    res.json(toCardJson(card));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSavedItem: getSavedItem,
  deleteSavedItem: deleteSavedItem,
  updateNotes: updateNotes,
  listFlashcards: listFlashcards,
  createFlashcards: createFlashcards,
  deleteFlashcards: deleteFlashcards,
  updateFlashcardStatus: updateFlashcardStatus,
};
