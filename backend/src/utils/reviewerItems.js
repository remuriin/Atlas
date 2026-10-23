// Turns database rows into the shape the frontend expects.
// Shared by the reviewers and "me" controllers so both always answer the same way.
const upvotesModel = require('../models/upvotesModel');
const savedItemsModel = require('../models/savedItemsModel');
const validate = require('./validate');

// "user" is the logged-in user's database row, or null for a visitor.
// "savedId" is the id of the user's saved copy of this reviewer, or null.
const toReviewerJson = (row, hasUpvoted, savedId, user) => {
  let isOwner = false;
  if (user && user.id === row.author_id) {
    isOwner = true;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    tags: validate.tagsToArray(row.tags),
    authorName: row.author_name,
    fileName: row.file_name,
    fileMime: row.file_mime,
    fileSize: row.file_size,
    upvoteCount: Number(row.upvote_count),
    hasUpvoted: hasUpvoted,
    isOwner: isOwner,
    isSaved: savedId !== null,
    savedId: savedId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// Checks the reviewers for the current user's upvotes and saved copies, then formats them.
// Two database trips cover the whole list, however long it is.
const buildReviewerItems = async (rows, user) => {
  let upvotedIds = [];
  let savedIds = {};
  if (user) {
    upvotedIds = await upvotesModel.findUpvotedReviewerIds(
      rows.map((row) => row.id),
      user.id
    );
    savedIds = await savedItemsModel.listSavedIdsByReviewer(user.id);
  }

  return rows.map((row) => {
    let savedId = null;
    if (savedIds[row.id]) {
      savedId = savedIds[row.id];
    }
    return toReviewerJson(row, upvotedIds.indexOf(row.id) !== -1, savedId, user);
  });
};

// The same for a single reviewer.
const buildReviewerItem = async (row, user) => {
  const items = await buildReviewerItems([row], user);
  return items[0];
};

// Turns a saved item row (joined with its reviewer, see savedItemsModel) into the
// shape the Saved page expects. When the original was deleted, isRemoved is true and
// only the copied title and subject are left.
const toSavedJson = (row) => {
  const isRemoved = row.live_reviewer_id === null;

  const item = {
    id: row.id,
    reviewerId: row.reviewer_id,
    isRemoved: isRemoved,
    title: row.saved_title,
    subject: row.saved_subject,
    // Formatted notes can hold only empty tags, so check the text a person would see.
    hasNotes: validate.visibleNotesText(row.notes).trim() !== '',
    notesUpdatedAt: row.notes_updated_at,
    flashcardCount: Number(row.flashcard_count),
    savedAt: row.saved_at,
    reviewer: null,
  };

  if (!isRemoved) {
    item.title = row.title;
    item.subject = row.subject;
    item.reviewer = {
      id: row.live_reviewer_id,
      description: row.description,
      tags: validate.tagsToArray(row.tags),
      authorName: row.author_name,
      fileName: row.file_name,
      fileMime: row.file_mime,
      fileSize: row.file_size,
      upvoteCount: Number(row.upvote_count),
      createdAt: row.created_at,
    };
  }
  return item;
};

module.exports = {
  toSavedJson: toSavedJson,
  buildReviewerItem: buildReviewerItem,
  buildReviewerItems: buildReviewerItems,
};
