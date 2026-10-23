// Loads a saved item for routes that have ":savedId" in their address.
const savedItemsModel = require('../models/savedItemsModel');
const validate = require('../utils/validate');
const createHttpError = require('../utils/httpError');

// Runs after requireAuth. Checks the id, loads the row, and stores it on req.saved.
// Someone else's saved item gets the same 404 as a missing one, so nobody can
// find out what other people have saved by trying ids.
const loadSavedItem = async (req, res, next) => {
  const savedItemId = validate.parseId(req.params.savedId);
  if (savedItemId === null) {
    next(createHttpError(400, 'That saved item id is not valid.'));
    return;
  }

  try {
    const saved = await savedItemsModel.findSavedById(savedItemId);
    if (!saved || saved.user_id !== req.user.id) {
      next(createHttpError(404, 'That saved item could not be found.'));
      return;
    }
    req.saved = saved;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  loadSavedItem: loadSavedItem,
};
