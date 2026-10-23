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

// Word and PowerPoint files are accepted, but they can only be downloaded, not
// opened inside LearnHub. Returns a friendly note for those, or '' for other files.
export const describeOfficeLimits = (fileName) => {
  const extension = getExtension(fileName);
  if (extension === 'doc' || extension === 'ppt') {
    return 'Old Word and PowerPoint files (.doc, .ppt) can only be downloaded: they cannot be opened inside LearnHub or turned into flashcards. Saving it as a PDF first works best.';
  }
  if (extension === 'docx' || extension === 'pptx') {
    return 'Word and PowerPoint files can only be downloaded, not opened inside LearnHub. Saving it as a PDF first lets people read it right here.';
  }
  return '';
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
