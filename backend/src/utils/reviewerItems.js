// Turns database rows into the shape the frontend expects.
// Shared by the reviewers and "me" controllers so both always answer the same way.
const upvotesModel = require('../models/upvotesModel');
const validate = require('./validate');

// "user" is the logged-in user's database row, or null for a visitor.
const toReviewerJson = (row, hasUpvoted, user) => {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// Checks one reviewer for the current user's upvote, then formats it.
const buildReviewerItem = async (row, user) => {
  let hasUpvoted = false;
  if (user) {
    const upvote = await upvotesModel.findUpvote(row.id, user.id);
    hasUpvoted = Boolean(upvote);
  }
  return toReviewerJson(row, hasUpvoted, user);
};

// One small query per item keeps the SQL simple. A page has at most 50 items.
const buildReviewerItems = async (rows, user) => {
  const items = [];
  for (const row of rows) {
    const item = await buildReviewerItem(row, user);
    items.push(item);
  }
  return items;
};

module.exports = {
  buildReviewerItem: buildReviewerItem,
  buildReviewerItems: buildReviewerItems,
};
