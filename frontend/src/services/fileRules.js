// Which files can be uploaded. The server checks the same rules again,
// because checks in the browser are only there to give fast feedback.

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'png', 'jpg', 'jpeg'];

// Used for the file picker's "accept" setting.
export const ACCEPT_ATTRIBUTE = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg';

export const ALLOWED_TYPES_TEXT = 'PDF, Word, PowerPoint, text, PNG, or JPG';

let maxFileSizeMb = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB);
if (!maxFileSizeMb || maxFileSizeMb <= 0) {
  maxFileSizeMb = 10;
}

export const MAX_FILE_SIZE_MB = maxFileSizeMb;

export const getExtension = (fileName) => {
  const parts = fileName.toLowerCase().split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts[parts.length - 1];
};

// Returns a message describing the problem, or '' when the file is fine.
export const validateFile = (file) => {
  if (ALLOWED_EXTENSIONS.indexOf(getExtension(file.name)) === -1) {
    return `That file type is not allowed. Choose a ${ALLOWED_TYPES_TEXT} file.`;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `That file is too large. The limit is ${MAX_FILE_SIZE_MB} MB.`;
  }
  if (file.size === 0) {
    return 'That file is empty. Choose a different file.';
  }
  return '';
};
