// Request handler for the Atlas Explorer's chat: a question about Atlas, answered by Rem
// from the Atlas docs.
const rem = require('../utils/rem');
const createHttpError = require('../utils/httpError');

const QUESTION_MAX = 2000;
const HISTORY_TURNS = 6;
const TURN_MAX = 500;

// Keeps the last few turns of the conversation, each one cut to a short length.
const cleanHistory = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const turns = [];
  value.forEach((turn) => {
    if (!turn || typeof turn.content !== 'string') {
      return;
    }
    if (turn.role !== 'user' && turn.role !== 'assistant') {
      return;
    }
    turns.push({ role: turn.role, content: turn.content.slice(0, TURN_MAX) });
  });
  return turns.slice(-HISTORY_TURNS);
};

// POST /api/ask   body: { question, history }
const ask = async (req, res, next) => {
  try {
    const body = req.body || {};
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (question === '') {
      throw createHttpError(400, 'Type a question first.');
    }
    if (question.length > QUESTION_MAX) {
      throw createHttpError(400, `Keep the question under ${QUESTION_MAX} characters.`);
    }
    const reply = await rem.askRem(question, cleanHistory(body.history));
    res.json(reply);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  ask: ask,
};
