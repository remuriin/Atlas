// Handles file uploads with multer: which files are allowed, how big,
// and what they are called on disk.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const createHttpError = require('../utils/httpError');

// The allowlist. A file is accepted only when BOTH its extension and the
// content type sent by the browser match one of these pairs. After the upload,
// middleware/checkUpload.js also checks what is really inside the file.
// Old .doc and .ppt files are not accepted: they can carry macros, the most
// common way Office files spread malware. Files uploaded before still download.
const ALLOWED_FILE_TYPES = [
  { extension: '.pdf', mime: 'application/pdf' },
  {
    extension: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    extension: '.pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  { extension: '.txt', mime: 'text/plain' },
  { extension: '.png', mime: 'image/png' },
  { extension: '.jpg', mime: 'image/jpeg' },
  { extension: '.jpeg', mime: 'image/jpeg' },
];

// Make sure the uploads folder exists before the first upload arrives.
fs.mkdirSync(env.uploadDir, { recursive: true });

const findAllowedType = (originalName) => {
  const extension = path.extname(originalName || '').toLowerCase();
  const match = ALLOWED_FILE_TYPES.find((type) => type.extension === extension);
  return match || null;
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, env.uploadDir);
  },
  filename: (req, file, callback) => {
    // The name on disk is random and never comes from the visitor, so a tricky
    // name such as "../../server.js" cannot escape the uploads folder.
    const allowedType = findAllowedType(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    callback(null, `${randomName}${allowedType.extension}`);
  },
});

// Runs before the file is saved, so rejected files never touch the disk.
const fileFilter = (req, file, callback) => {
  const allowedType = findAllowedType(file.originalname);
  if (!allowedType || allowedType.mime !== file.mimetype) {
    callback(
      createHttpError(
        415,
        'That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file.',
        { file: 'That file type is not allowed. Use PDF, DOCX, PPTX, TXT, PNG, or JPG.' }
      )
    );
    return;
  }
  callback(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  // Read file names as UTF-8 so names with accents or non-Latin letters stay readable.
  defParamCharset: 'utf8',
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 20 * 1024,
  },
});

// Builds the full path of a stored file. path.basename throws away any folder
// parts, as a second guard against reading or deleting outside the uploads folder.
const getStoredFilePath = (storedName) => {
  return path.join(env.uploadDir, path.basename(storedName));
};

// Deletes a stored file. A missing file is not an error: the goal is "it is gone".
const removeStoredFile = async (storedName) => {
  if (!storedName) {
    return;
  }
  try {
    await fs.promises.unlink(getStoredFilePath(storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Could not delete uploaded file:', err.message);
    }
  }
};

// Tidies the name the visitor's file had, for display and for the download name.
const cleanOriginalName = (originalName) => {
  const baseName = path.basename(originalName || 'file');
  // Remove invisible control characters, then keep the name a sensible length.
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (cleaned === '') {
    return 'file';
  }
  return cleaned.slice(-200);
};

module.exports = {
  // Use as route middleware: the uploaded file must be in the form field named "file".
  single: upload.single('file'),
  findAllowedType: findAllowedType,
  getStoredFilePath: getStoredFilePath,
  removeStoredFile: removeStoredFile,
  cleanOriginalName: cleanOriginalName,
};
