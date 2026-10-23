// Request handlers for study reviewers.
// Controllers decide WHAT should happen; the SQL itself lives in the models folder.
const fs = require('fs');
const reviewersModel = require('../models/reviewersModel');
const upvotesModel = require('../models/upvotesModel');
const recentlyViewedModel = require('../models/recentlyViewedModel');
const savedItemsModel = require('../models/savedItemsModel');
const upload = require('../middleware/upload');
const validate = require('../utils/validate');
const reviewerItems = require('../utils/reviewerItems');
const createHttpError = require('../utils/httpError');

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const UNIQUE_VIOLATION = '23505';

// These file types are safe and useful to show inside the browser tab.
// Everything else is offered as a download.
const INLINE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

// Picks the model function that matches the chosen tab.
const fetchReviewerRows = async (sort, subject, searchPattern, limit, offset) => {
  if (sort === 'new') {
    return reviewersModel.listNewReviewers(subject, searchPattern, limit, offset);
  }
  return reviewersModel.listTopReviewers(subject, searchPattern, limit, offset);
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
    const rows = await fetchReviewerRows(
      sort,
      subject,
      validate.buildSearchPattern(searchText),
      limit + 1,
      (page - 1) * limit
    );
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

// Builds a download name that is safe to put inside a response header.
const buildContentDisposition = (mode, fileName) => {
  // Older browsers read the plain name, so it may only contain simple characters.
  const simpleName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  // Modern browsers read the encoded name, which keeps accents and other alphabets.
  const encodedName = encodeURIComponent(fileName);
  return `${mode}; filename="${simpleName}"; filename*=UTF-8''${encodedName}`;
};

// GET /api/reviewers/:id/file   (add ?download=1 to always save it instead of showing it)
const sendReviewerFile = async (req, res, next) => {
  try {
    const reviewer = req.reviewer;
    const filePath = upload.getStoredFilePath(reviewer.stored_name);

    try {
      await fs.promises.access(filePath);
    } catch (err) {
      throw createHttpError(404, 'The file for this study reviewer is missing.');
    }

    let mode = 'attachment';
    const isDownloadAsked = req.query.download === '1';
    if (!isDownloadAsked && INLINE_MIME_TYPES.indexOf(reviewer.file_mime) !== -1) {
      mode = 'inline';
    }

    // nosniff tells the browser to trust our content type and not guess its own,
    // which stops a disguised file from being run as a web page.
    res.setHeader('Content-Type', reviewer.file_mime);
    res.setHeader('Content-Length', reviewer.file_size);
    res.setHeader('Content-Disposition', buildContentDisposition(mode, reviewer.file_name));
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      // The headers may already be sent, so the only safe option is to end the reply.
      console.error('Could not read uploaded file:', err.message);
      res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

// POST /api/reviewers
const createReviewer = async (req, res, next) => {
  // Remembers whether the database now points at the uploaded file.
  let isSaved = false;

  try {
    if (!req.file) {
      throw createHttpError(400, 'Choose a file to upload.', { file: 'Choose a file to upload.' });
    }
    const input = validate.validateReviewerFields(req.body);
    const allowedType = upload.findAllowedType(req.file.originalname);

    const created = await reviewersModel.createReviewer({
      authorId: req.user.id,
      title: input.title,
      description: input.description,
      subject: input.subject,
      tags: input.tags,
      fileName: upload.cleanOriginalName(req.file.originalname),
      storedName: req.file.filename,
      // Save the content type from our own allowlist, not the one the browser claimed.
      fileMime: allowedType.mime,
      fileSize: req.file.size,
    });
    isSaved = true;

    const row = await reviewersModel.findReviewerById(created.id);
    const item = await reviewerItems.buildReviewerItem(row, req.user);
    res.status(201).json(item);
  } catch (err) {
    // If nothing was saved, the uploaded file would be left behind with no owner.
    if (!isSaved && req.file) {
      await upload.removeStoredFile(req.file.filename);
    }
    next(err);
  }
};

// PUT /api/reviewers/:id   (requireOwner has already checked permission)
const updateReviewer = async (req, res, next) => {
  let isSaved = false;

  try {
    const reviewerId = req.reviewer.id;
    const input = validate.validateReviewerFields(req.body);

    if (req.file) {
      const allowedType = upload.findAllowedType(req.file.originalname);
      await reviewersModel.updateReviewerWithFile(reviewerId, {
        title: input.title,
        description: input.description,
        subject: input.subject,
        tags: input.tags,
        fileName: upload.cleanOriginalName(req.file.originalname),
        storedName: req.file.filename,
        fileMime: allowedType.mime,
        fileSize: req.file.size,
      });
      isSaved = true;
      // The database now points at the new file, so the old one can go.
      await upload.removeStoredFile(req.reviewer.stored_name);
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
    if (!isSaved && req.file) {
      await upload.removeStoredFile(req.file.filename);
    }
    next(err);
  }
};

// DELETE /api/reviewers/:id   (requireOwner has already checked permission)
const deleteReviewer = async (req, res, next) => {
  try {
    // Delete the row first. If that fails, the file is still there and nothing is broken.
    await reviewersModel.deleteReviewer(req.reviewer.id);
    await upload.removeStoredFile(req.reviewer.stored_name);
    res.json({ deleted: true, id: req.reviewer.id });
  } catch (err) {
    next(err);
  }
};

// Sends the fresh upvote total, counted in the database at this moment.
const sendUpvoteState = async (res, reviewerId, hasUpvoted) => {
  const upvoteCount = await upvotesModel.countUpvotes(reviewerId);
  res.json({ upvoteCount: upvoteCount, hasUpvoted: hasUpvoted });
};

// PUT /api/reviewers/:id/upvote
const addUpvote = async (req, res, next) => {
  try {
    const reviewerId = req.reviewer.id;
    const existingUpvote = await upvotesModel.findUpvote(reviewerId, req.user.id);

    if (!existingUpvote) {
      try {
        await upvotesModel.createUpvote(reviewerId, req.user.id);
      } catch (err) {
        // A double click can send two requests at once. The primary key blocks the
        // second INSERT, which is fine: the upvote exists, and that is what was asked for.
        if (err.code !== UNIQUE_VIOLATION) {
          throw err;
        }
      }
    }

    await sendUpvoteState(res, reviewerId, true);
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
    const reviewerId = req.reviewer.id;
    const existingView = await recentlyViewedModel.findView(req.user.id, reviewerId);

    if (existingView) {
      await recentlyViewedModel.updateViewTime(req.user.id, reviewerId);
    } else {
      try {
        await recentlyViewedModel.createView(req.user.id, reviewerId);
      } catch (err) {
        // Same idea as upvotes: a duplicate from two quick requests is harmless.
        if (err.code !== UNIQUE_VIOLATION) {
          throw err;
        }
      }
    }

    res.json({ recorded: true });
  } catch (err) {
    next(err);
  }
};

// PUT /api/reviewers/:id/save   (safe to repeat: saving twice keeps one copy)
const saveReviewer = async (req, res, next) => {
  try {
    const reviewer = req.reviewer;
    let saved = await savedItemsModel.findSavedByUserAndReviewer(req.user.id, reviewer.id);

    if (!saved) {
      try {
        saved = await savedItemsModel.createSavedItem(
          req.user.id,
          reviewer.id,
          reviewer.title,
          reviewer.subject
        );
      } catch (err) {
        // Same idea as upvotes: two quick clicks can both try to INSERT.
        if (err.code !== UNIQUE_VIOLATION) {
          throw err;
        }
        saved = await savedItemsModel.findSavedByUserAndReviewer(req.user.id, reviewer.id);
      }
    }

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
  createReviewer: createReviewer,
  updateReviewer: updateReviewer,
  deleteReviewer: deleteReviewer,
  addUpvote: addUpvote,
  removeUpvote: removeUpvote,
  recordView: recordView,
};
