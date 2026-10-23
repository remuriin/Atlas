// Request handlers for study reviewers.
// Controllers decide WHAT should happen; the database code itself lives in the models folder.
const reviewersModel = require('../models/reviewersModel');
const upvotesModel = require('../models/upvotesModel');
const recentlyViewedModel = require('../models/recentlyViewedModel');
const savedItemsModel = require('../models/savedItemsModel');
const storedFiles = require('../utils/storedFiles');
const validate = require('../utils/validate');
const reviewerItems = require('../utils/reviewerItems');
const createHttpError = require('../utils/httpError');

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

// These file types are safe and useful to show inside the browser tab.
// Everything else is offered as a download.
const INLINE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

// Picks the model function that matches the chosen tab.
const fetchReviewerRows = async (sort, subject, searchText, limit, offset) => {
  if (sort === 'new') {
    return reviewersModel.listNewReviewers(subject, searchText, limit, offset);
  }
  return reviewersModel.listTopReviewers(subject, searchText, limit, offset);
};

// GET /api/reviewers
const listReviewers = async (req, res, next) => {
  try {
    const sort = validate.cleanText(req.query.sort) || 'top';
    if (sort !== 'top' && sort !== 'new') {
      throw createHttpError(400, '"sort" must be top or new.');
    }

    const subject = validate.cleanText(req.query.subject);
    const searchText = validate.cleanText(req.query.q).slice(0, validate.LIMITS.searchMax);
    const page = validate.parsePositiveNumber(req.query.page, 1, 'page');
    let limit = validate.parsePositiveNumber(req.query.limit, DEFAULT_PAGE_SIZE, 'limit');
    if (limit > MAX_PAGE_SIZE) {
      limit = MAX_PAGE_SIZE;
    }

    // Ask for one extra row. If it comes back, there is at least one more page.
    const rows = await fetchReviewerRows(sort, subject, searchText, limit + 1, (page - 1) * limit);
    const hasMore = rows.length > limit;
    const pageRows = rows.filter((row, index) => index < limit);
    const items = await reviewerItems.buildReviewerItems(pageRows, req.user);

    res.json({ items: items, page: page, hasMore: hasMore });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviewers/:id   (loadReviewer has already put the row on req.reviewer)
const getReviewer = async (req, res, next) => {
  try {
    const item = await reviewerItems.buildReviewerItem(req.reviewer, req.user);
    res.json(item);
  } catch (err) {
    next(err);
  }
};

// Picks 'inline' (show it in the browser tab) or 'attachment' (always save it).
const chooseFileMode = (req) => {
  if (req.query.download !== '1' && INLINE_MIME_TYPES.indexOf(req.reviewer.file_mime) !== -1) {
    return 'inline';
  }
  return 'attachment';
};

// GET /api/reviewers/:id/file   (add ?download=1 to always save it instead of showing it)
// Sends the visitor on to a short-lived link to the file in Cloud Storage.
const sendReviewerFile = async (req, res, next) => {
  try {
    const mode = chooseFileMode(req);
    if (!storedFiles.canMakeFileLinks) {
      await storedFiles.sendStoredFile(res, req.reviewer, mode);
      return;
    }
    const url = await storedFiles.createFileLink(req.reviewer, mode);
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
};

// GET /api/reviewers/:id/file-link   (same ?download=1 option)
// Answers with that link as JSON, so the page can fetch the file itself.
// url is null with the local emulators: the page then uses /file instead.
const getReviewerFileLink = async (req, res, next) => {
  try {
    if (!storedFiles.canMakeFileLinks) {
      res.json({ url: null });
      return;
    }
    const url = await storedFiles.createFileLink(req.reviewer, chooseFileMode(req));
    res.json({ url: url });
  } catch (err) {
    next(err);
  }
};

// Removes an upload that will not be used: the moved file if it got that far,
// or else the file still waiting in the user's inbox.
const removeUnusedUpload = async (req, body, claimed) => {
  if (claimed) {
    await storedFiles.removeStoredFile(claimed.storedName);
    return;
  }
  if (body.file) {
    await storedFiles.removePendingFile(req.user.firebase_uid, body.file);
  }
};

// POST /api/reviewers   (JSON: title, description, subject, tags, file: { path, name })
// The browser has already put the file in the user's inbox in Cloud Storage.
const createReviewer = async (req, res, next) => {
  const body = req.body || {};
  // Remembers the file once it is out of the inbox, and whether the database now points at it.
  let claimed = null;
  let isSaved = false;

  try {
    if (!body.file) {
      throw createHttpError(400, 'Choose a file to upload.', { file: 'Choose a file to upload.' });
    }
    const input = validate.validateReviewerFields(body);
    claimed = await storedFiles.claimPendingFile(req.user.firebase_uid, body.file);

    const created = await reviewersModel.createReviewer({
      authorId: req.user.id,
      authorName: req.user.display_name,
      title: input.title,
      description: input.description,
      subject: input.subject,
      tags: input.tags,
      fileName: claimed.fileName,
      storedName: claimed.storedName,
      fileMime: claimed.fileMime,
      fileSize: claimed.fileSize,
    });
    isSaved = true;

    const row = await reviewersModel.findReviewerById(created.id);
    const item = await reviewerItems.buildReviewerItem(row, req.user);
    res.status(201).json(item);
  } catch (err) {
    // If nothing was saved, the uploaded file would be left behind with no owner.
    if (!isSaved) {
      await removeUnusedUpload(req, body, claimed);
    }
    next(err);
  }
};

// PUT /api/reviewers/:id   (requireOwner has already checked permission)
// Same JSON as creating; leave "file" out to keep the current file.
const updateReviewer = async (req, res, next) => {
  const body = req.body || {};
  let claimed = null;
  let isSaved = false;

  try {
    const reviewerId = req.reviewer.id;
    const input = validate.validateReviewerFields(body);

    if (body.file) {
      claimed = await storedFiles.claimPendingFile(req.user.firebase_uid, body.file);
      await reviewersModel.updateReviewerWithFile(reviewerId, {
        title: input.title,
        description: input.description,
        subject: input.subject,
        tags: input.tags,
        fileName: claimed.fileName,
        storedName: claimed.storedName,
        fileMime: claimed.fileMime,
        fileSize: claimed.fileSize,
      });
      isSaved = true;
      // The database now points at the new file, so the old one can go.
      await storedFiles.removeStoredFile(req.reviewer.stored_name);
    } else {
      await reviewersModel.updateReviewer(reviewerId, input);
      isSaved = true;
    }

    // Saved copies keep their own title and subject for the day the original is
    // deleted, so bring those up to date as well.
    await savedItemsModel.refreshSnapshot(reviewerId, input.title, input.subject);

    const row = await reviewersModel.findReviewerById(reviewerId);
    if (!row) {
      throw createHttpError(404, 'That study reviewer could not be found.');
    }
    const item = await reviewerItems.buildReviewerItem(row, req.user);
    res.json(item);
  } catch (err) {
    // The update failed, so the old file is still the real one. Remove the new upload.
    if (!isSaved) {
      await removeUnusedUpload(req, body, claimed);
    }
    next(err);
  }
};

// DELETE /api/reviewers/:id   (requireOwner has already checked permission)
const deleteReviewer = async (req, res, next) => {
  try {
    const reviewerId = req.reviewer.id;
    // Delete the reviewer first. If that fails, the file is still there and nothing is broken.
    await reviewersModel.deleteReviewer(reviewerId);
    // Then tidy up everything that pointed at it. Saved copies are kept, with their
    // notes and flashcards; they just stop pointing at the deleted original.
    await upvotesModel.deleteUpvotesForReviewer(reviewerId);
    await recentlyViewedModel.deleteViewsForReviewer(reviewerId);
    await savedItemsModel.detachReviewer(reviewerId);
    await storedFiles.removeStoredFile(req.reviewer.stored_name);
    res.json({ deleted: true, id: reviewerId });
  } catch (err) {
    next(err);
  }
};

// Sends the fresh upvote total, read from the database at this moment.
const sendUpvoteState = async (res, reviewerId, hasUpvoted) => {
  const upvoteCount = await upvotesModel.countUpvotes(reviewerId);
  res.json({ upvoteCount: upvoteCount, hasUpvoted: hasUpvoted });
};

// PUT /api/reviewers/:id/upvote
// A double click can send two requests at once. That is fine: createUpvote only
// adds the upvote when it is not there yet, and that is what was asked for.
const addUpvote = async (req, res, next) => {
  try {
    await upvotesModel.createUpvote(req.reviewer.id, req.user.id);
    await sendUpvoteState(res, req.reviewer.id, true);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviewers/:id/upvote
const removeUpvote = async (req, res, next) => {
  try {
    await upvotesModel.deleteUpvote(req.reviewer.id, req.user.id);
    await sendUpvoteState(res, req.reviewer.id, false);
  } catch (err) {
    next(err);
  }
};

// POST /api/reviewers/:id/view
const recordView = async (req, res, next) => {
  try {
    await recentlyViewedModel.recordView(req.user.id, req.reviewer.id);
    res.json({ recorded: true });
  } catch (err) {
    next(err);
  }
};

// PUT /api/reviewers/:id/save   (safe to repeat: saving twice keeps one copy)
const saveReviewer = async (req, res, next) => {
  try {
    const reviewer = req.reviewer;
    // createSavedItem gives back the existing copy when there already is one.
    const saved = await savedItemsModel.createSavedItem(
      req.user.id,
      reviewer.id,
      reviewer.title,
      reviewer.subject
    );
    res.json({ isSaved: true, savedId: saved.id });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviewers/:id/save   (also deletes the notes and flashcards for it)
const unsaveReviewer = async (req, res, next) => {
  try {
    await savedItemsModel.deleteSavedByUserAndReviewer(req.user.id, req.reviewer.id);
    res.json({ isSaved: false, savedId: null });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  saveReviewer: saveReviewer,
  unsaveReviewer: unsaveReviewer,
  listReviewers: listReviewers,
  getReviewer: getReviewer,
  sendReviewerFile: sendReviewerFile,
  getReviewerFileLink: getReviewerFileLink,
  createReviewer: createReviewer,
  updateReviewer: updateReviewer,
  deleteReviewer: deleteReviewer,
  addUpvote: addUpvote,
  removeUpvote: removeUpvote,
  recordView: recordView,
};
