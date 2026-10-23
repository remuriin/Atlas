// Server-side checks for everything a visitor can send us.
// The frontend runs similar checks for fast feedback, but only these ones can be trusted.
const createHttpError = require('./httpError');

// Keep this list the same as frontend/src/services/subjects.js.
const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Social Studies',
  'Computer Science',
  'Engineering',
  'Business',
  'Health and Medicine',
  'Languages',
  'Arts',
  'Other',
];

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

// Checks the text fields of the upload/edit form.
// Returns clean values, or throws a 400 error listing every problem.
const validateReviewerFields = (body) => {
  const input = body || {};
  const title = cleanText(input.title);
  const description = cleanText(input.description);
  const subject = cleanText(input.subject);
  const tags = parseTags(input.tags);
  const fields = {};

  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    fields.title = `Title must be between ${LIMITS.titleMin} and ${LIMITS.titleMax} characters.`;
  }
  if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
    fields.description = `Description must be between ${LIMITS.descriptionMin} and ${LIMITS.descriptionMax} characters.`;
  }
  if (SUBJECTS.indexOf(subject) === -1) {
    fields.subject = 'Choose a subject from the list.';
  }
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
    subject: subject,
    // Stored as one comma-separated string, as the schema describes.
    tags: tags.join(','),
  };
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
  SUBJECTS: SUBJECTS,
  LIMITS: LIMITS,
  cleanText: cleanText,
  parseId: parseId,
  parseTags: parseTags,
  tagsToArray: tagsToArray,
  validateReviewerFields: validateReviewerFields,
  validateDisplayName: validateDisplayName,
  validateNotes: validateNotes,
  visibleNotesText: visibleNotesText,
  validateFlashcardCount: validateFlashcardCount,
  validateFlashcardStatus: validateFlashcardStatus,
  parsePositiveNumber: parsePositiveNumber,
  buildSearchPattern: buildSearchPattern,
};
