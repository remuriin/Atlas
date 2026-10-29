// Turns database rows into the shape the frontend expects.
// Shared by the reviewers and "me" controllers so both always answer the same way.
const upvotesModel = require('../models/upvotesModel');
const savedItemsModel = require('../models/savedItemsModel');
const validate = require('./validate');

// "user" is the logged-in user's database row, or null for a visitor.
// "saved" is the user's saved_items row for this reviewer, or null.
const toReviewerJson = (row, hasUpvoted, saved, user) => {
  let isOwner = false;
  if (user && user.id === row.author_id) {
    isOwner = true;
  }

  let savedId = null;
  if (saved) {
    savedId = saved.id;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    strand: row.strand,
    grade: row.grade,
    quarter: row.quarter,
    subject: row.subject,
    materialType: row.material_type,
    tags: validate.tagsToArray(row.tags),
    authorName: row.author_name,
    fileName: row.file_name,
    fileMime: row.file_mime,
    fileSize: row.file_size,
    upvoteCount: Number(row.upvote_count),
    hasUpvoted: hasUpvoted,
    isOwner: isOwner,
    // Only the uploader and admins can open a hidden reviewer, so only they see this as true.
    isHidden: row.is_hidden,
    isSaved: savedId !== null,
    savedId: savedId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// Checks one reviewer for the current user's upvote and saved copy, then formats it.
const buildReviewerItem = async (row, user) => {
  let hasUpvoted = false;
  let saved = null;
  if (user) {
    const upvote = await upvotesModel.findUpvote(row.id, user.id);
    hasUpvoted = Boolean(upvote);
    saved = await savedItemsModel.findSavedByUserAndReviewer(user.id, row.id);
  }
  return toReviewerJson(row, hasUpvoted, saved, user);
};

// Two small queries per item keep the SQL simple. A page has at most 50 items.
const buildReviewerItems = async (rows, user) => {
  const items = [];
  for (const row of rows) {
    const item = await buildReviewerItem(row, user);
    items.push(item);
  }
  return items;
};

// Turns a saved_items row (joined with its reviewer, see savedItemsModel) into the
// shape the Saved page expects. When the original was deleted, isRemoved is true and
// only the copied title, subject, and strand are left.
const toSavedJson = (row) => {
  const isRemoved = row.live_reviewer_id === null;

  const item = {
    id: row.id,
    reviewerId: row.reviewer_id,
    isRemoved: isRemoved,
    title: row.saved_title,
    subject: row.saved_subject,
    strand: row.saved_strand,
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
    item.strand = row.strand;
    item.reviewer = {
      id: row.live_reviewer_id,
      description: row.description,
      grade: row.grade,
      quarter: row.quarter,
      materialType: row.material_type,
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
