// The subjects a study reviewer can be filed under.
// Keep this list the same as SUBJECTS in backend/src/utils/validate.js.
export const SUBJECTS = [
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

// A short name for each subject, used in CSS class names such as "subject--math".
// The colors themselves are the --subject-* tokens in styles/tokens.css.
const SUBJECT_SLUGS = {
  Mathematics: 'math',
  Science: 'science',
  English: 'english',
  History: 'history',
  'Social Studies': 'social',
  'Computer Science': 'cs',
  Engineering: 'engineering',
  Business: 'business',
  'Health and Medicine': 'health',
  Languages: 'languages',
  Arts: 'arts',
  Other: 'other',
};

// "Social Studies" -> "social". Anything unknown gets the "other" color.
export const subjectSlug = (subject) => {
  return SUBJECT_SLUGS[subject] || 'other';
};
