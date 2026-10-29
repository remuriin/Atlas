// Server-side checks for everything a visitor can send us.
// The frontend runs similar checks for fast feedback, but only these ones can be trusted.
const createHttpError = require('./httpError');
const categories = require('./categories');

const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 2000,
  maxTags: 8,
  tagMax: 30,
  displayNameMin: 2,
  displayNameMax: 50,
  searchMax: 100,
  notesMax: 20000,
  notesHtmlMax: 100000,
  flashcardsMin: 5,
  flashcardsMax: 100,
};

const FLASHCARD_STATUSES = ['new', 'learning', 'learned'];

// Why a study reviewer can be reported.
// Keep this list the same as frontend/src/services/reportsService.js.
const REPORT_REASONS = ['Offensive', 'Spam', 'Irrelevant', 'Wrong category', 'Copyright'];
const REPORT_DETAILS_MAX = 500;

// The only tags formatted notes may contain, written out in full: no other
// attributes are possible, so nothing in the notes can run code or load anything.
// Keep in step with frontend/src/services/noteHtml.js.
const NOTES_TAG_PATTERNS = [
  /^<\/?(p|h1|h2|h3|strong|em|ul|li|blockquote)>$/,
  /^<br\s*\/?>$/,
  /^<span class="tc-(red|orange|green|blue|purple)">$/,
  /^<mark class="hl-(yellow|green|blue|pink|orange)">$/,
  /^<\/(span|mark)>$/,
];

const isAllowedNotesTag = (tag) => {
  return NOTES_TAG_PATTERNS.some((pattern) => pattern.test(tag));
};

// The text a person actually sees: tags removed, character codes turned back into characters.
const visibleNotesText = (html) => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
};

// The largest number a Postgres INTEGER column can hold.
const MAX_INTEGER = 2147483647;

// Turns any incoming value into a trimmed string ("" when it is missing).
const cleanText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

// Returns the id as a number, or null when it is not a positive whole number.
const parseId = (value) => {
  if (typeof value !== 'string' || !/^[0-9]{1,10}$/.test(value)) {
    return null;
  }
  const id = Number(value);
  if (id < 1 || id > MAX_INTEGER) {
    return null;
  }
  return id;
};

// "Calculus, midterm ,, Calculus" becomes ['calculus', 'midterm'].
const parseTags = (value) => {
  const cleaned = cleanText(value)
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '');
  // Keep only the first copy of each tag.
  return cleaned.filter((tag, index) => cleaned.indexOf(tag) === index);
};

// Turns the comma-separated text stored in the database back into a list.
const tagsToArray = (storedTags) => {
  if (!storedTags) {
    return [];
  }
  return storedTags.split(',').filter((tag) => tag !== '');
};

// Checks strand, grade, quarter, subject, and material type. Problems are added to
// "fields"; the clean values are returned.
const checkCategoryFields = (input, fields) => {
  const strand = cleanText(input.strand);
  const grade = cleanText(input.grade);
  const quarter = cleanText(input.quarter);
  const subject = cleanText(input.subject);
  const materialType = cleanText(input.materialType);

  if (categories.STRANDS.indexOf(strand) === -1) {
    fields.strand = 'Choose a strand from the list.';
  }
  if (categories.GRADES.indexOf(grade) === -1) {
    fields.grade = 'Choose Grade 11 or 12.';
  }
  if (categories.QUARTERS.indexOf(quarter) === -1) {
    fields.quarter = 'Choose a quarter from the list.';
  }
  // Only the strand's own subjects are allowed (skipped while the strand itself is wrong).
  if (!fields.strand && categories.subjectsForStrand(strand).indexOf(subject) === -1) {
    fields.subject = 'Choose a subject from the list for this strand.';
  }
  if (categories.MATERIAL_TYPES.indexOf(materialType) === -1) {
    fields.materialType = 'Choose a material type from the list.';
  }

  return {
    strand: strand,
    grade: grade,
    quarter: quarter,
    subject: subject,
    materialType: materialType,
  };
};

// Checks the category alone (an admin fixing where a reviewer is filed).
// Returns clean values, or throws a 400 error listing every problem.
const validateCategoryFields = (body) => {
  const fields = {};
  const category = checkCategoryFields(body || {}, fields);
  if (Object.keys(fields).length > 0) {
    throw createHttpError(400, 'Some details need fixing. Check the highlighted fields.', fields);
  }
  return category;
};

// Checks the text fields of the upload/edit form.
// Returns clean values, or throws a 400 error listing every problem.
const validateReviewerFields = (body) => {
  const input = body || {};
  const title = cleanText(input.title);
  const description = cleanText(input.description);
  const tags = parseTags(input.tags);
  const fields = {};

  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    fields.title = `Title must be between ${LIMITS.titleMin} and ${LIMITS.titleMax} characters.`;
  }
  if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
    fields.description = `Description must be between ${LIMITS.descriptionMin} and ${LIMITS.descriptionMax} characters.`;
  }
  const category = checkCategoryFields(input, fields);
  if (tags.length > LIMITS.maxTags) {
    fields.tags = `Use at most ${LIMITS.maxTags} tags.`;
  } else if (tags.find((tag) => tag.length > LIMITS.tagMax)) {
    fields.tags = `Each tag must be ${LIMITS.tagMax} characters or fewer.`;
  }

  if (Object.keys(fields).length > 0) {
    throw createHttpError(400, 'Some details need fixing. Check the highlighted fields.', fields);
  }

  return {
    title: title,
    description: description,
    strand: category.strand,
    grade: category.grade,
    quarter: category.quarter,
    subject: category.subject,
    materialType: category.materialType,
    // Stored as one comma-separated string, as the schema describes.
    tags: tags.join(','),
  };
};

// Every new file needs the uploader's "I made this, or I have the right to share it".
// The form sends the ticked box as the text "true". Throws a 400 error when it is missing.
const validateRightsConfirmed = (body) => {
  const input = body || {};
  if (input.rightsConfirmed !== 'true') {
    const message = 'Confirm that you made this file or have the right to share it.';
    throw createHttpError(400, message, { rightsConfirmed: message });
  }
};

// Checks a report: a reason from the list and optional details. Returns clean values
// or throws a 400 error.
const validateReport = (body) => {
  const input = body || {};
  const reason = cleanText(input.reason);
  const details = cleanText(input.details);
  const fields = {};
  if (REPORT_REASONS.indexOf(reason) === -1) {
    fields.reason = 'Choose a reason from the list.';
  }
  if (details.length > REPORT_DETAILS_MAX) {
    fields.details = `Details can be at most ${REPORT_DETAILS_MAX} characters.`;
  }
  if (Object.keys(fields).length > 0) {
    throw createHttpError(400, 'Some details need fixing. Check the highlighted fields.', fields);
  }
  return { reason: reason, details: details };
};

// Checks a display name. Returns the clean name or throws a 400 error.
const validateDisplayName = (value) => {
  const displayName = cleanText(value);
  if (displayName.length < LIMITS.displayNameMin || displayName.length > LIMITS.displayNameMax) {
    const message = `Display name must be between ${LIMITS.displayNameMin} and ${LIMITS.displayNameMax} characters.`;
    throw createHttpError(400, message, { displayName: message });
  }
  return displayName;
};

// Checks the formatted notes for a saved item (simple HTML from the notes editor).
// Notes may be empty. Returns the notes or throws a 400 error.
const validateNotes = (value) => {
  const fail = (message) => {
    throw createHttpError(400, message, { notes: message });
  };

  if (typeof value !== 'string') {
    fail('Notes must be text.');
  }
  if (value.length > LIMITS.notesHtmlMax) {
    fail('These notes are too long to save. Make them shorter.');
  }
  // A "<" that does not start a tag, or a tag that never closes, is not allowed either:
  // the editor always writes a "<" in the text as "&lt;".
  const tags = value.match(/<[^>]*>?/g) || [];
  if (tags.find((tag) => !isAllowedNotesTag(tag))) {
    fail('These notes contain formatting that is not allowed.');
  }
  if (visibleNotesText(value).length > LIMITS.notesMax) {
    fail(`Notes can be at most ${LIMITS.notesMax} characters.`);
  }
  return value;
};

// Checks the requested number of flashcards: a whole number from 5 to 100.
// A missing value means 20.
const validateFlashcardCount = (value) => {
  if (value === undefined || value === null || value === '') {
    return 20;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < LIMITS.flashcardsMin || count > LIMITS.flashcardsMax) {
    throw createHttpError(
      400,
      `Choose a whole number of flashcards from ${LIMITS.flashcardsMin} to ${LIMITS.flashcardsMax}.`
    );
  }
  return count;
};

const validateFlashcardStatus = (value) => {
  if (FLASHCARD_STATUSES.indexOf(value) === -1) {
    throw createHttpError(400, '"status" must be new, learning, or learned.');
  }
  return value;
};

// Reads a feed filter such as ?strand=. Anything not in the list means "do not filter".
const parseFilter = (value, allowedValues) => {
  const text = cleanText(value);
  if (allowedValues.indexOf(text) === -1) {
    return '';
  }
  return text;
};

// Reads ?page= or ?limit=. Missing values use the fallback; bad values throw a 400 error.
const parsePositiveNumber = (value, fallback, name) => {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !/^[0-9]{1,6}$/.test(value) || Number(value) < 1) {
    throw createHttpError(400, `"${name}" must be a whole number of 1 or more.`);
  }
  return Number(value);
};

// In a LIKE pattern, % and _ are wildcards. Putting a backslash in front makes
// Postgres treat them as ordinary characters, so a search for "100%" works as expected.
const buildSearchPattern = (searchText) => {
  if (searchText === '') {
    return '';
  }
  const escaped = searchText.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
};

module.exports = {
  LIMITS: LIMITS,
  cleanText: cleanText,
  parseId: parseId,
  parseTags: parseTags,
  tagsToArray: tagsToArray,
  validateReviewerFields: validateReviewerFields,
  validateCategoryFields: validateCategoryFields,
  validateRightsConfirmed: validateRightsConfirmed,
  validateReport: validateReport,
  validateDisplayName: validateDisplayName,
  validateNotes: validateNotes,
  visibleNotesText: visibleNotesText,
  validateFlashcardCount: validateFlashcardCount,
  validateFlashcardStatus: validateFlashcardStatus,
  parseFilter: parseFilter,
  parsePositiveNumber: parsePositiveNumber,
  buildSearchPattern: buildSearchPattern,
};
