// Everything about uploaded files: which ones are allowed, how big, what they are
// called in Cloud Storage, and how people get them back.
//
// How an upload works:
//   1. The browser puts the file in the user's own inbox folder, "pending/<uid>/".
//      Storage rules (storage.rules) only let a logged-in user write to their own
//      inbox, and only allowed file types up to the size limit.
//   2. The browser sends the form to the API with the file's inbox path.
//   3. claimPendingFile checks the file again here (only these checks can be trusted)
//      and moves it to "reviewers/<random name>". Inbox files that are never claimed
//      are removed after a day by a lifecycle rule on the bucket.
const crypto = require('crypto');
const path = require('path');
const { getBucket } = require('../config/firebase');
const env = require('../config/env');
const createHttpError = require('./httpError');

// The allowlist. A file is accepted only when BOTH its extension and its
// content type match one of these pairs.
const ALLOWED_FILE_TYPES = [
  { extension: '.pdf', mime: 'application/pdf' },
  { extension: '.doc', mime: 'application/msword' },
  {
    extension: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  { extension: '.ppt', mime: 'application/vnd.ms-powerpoint' },
  {
    extension: '.pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  { extension: '.txt', mime: 'text/plain' },
  { extension: '.png', mime: 'image/png' },
  { extension: '.jpg', mime: 'image/jpeg' },
  { extension: '.jpeg', mime: 'image/jpeg' },
];

const TYPE_NOT_ALLOWED = 'That file type is not allowed. Use PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, or JPG.';

// How long a link to a file keeps working. Long enough to open or download it.
const LINK_LIFETIME_MILLISECONDS = 10 * 60 * 1000;

const findAllowedType = (originalName) => {
  const extension = path.extname(originalName || '').toLowerCase();
  const match = ALLOWED_FILE_TYPES.find((type) => type.extension === extension);
  return match || null;
};

// The stored file of a reviewer. path.basename throws away any folder parts,
// as a guard against reaching outside the "reviewers" folder.
const getStoredFile = (storedName) => {
  return getBucket().file(`reviewers/${path.basename(storedName)}`);
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

// Returns the inbox file named in the form, or null when the path is not one of
// this user's own inbox files. Only "pending/<uid>/<one file name>" is accepted.
const findPendingFile = (uid, upload) => {
  if (!upload || typeof upload.path !== 'string') {
    return null;
  }
  const folder = `pending/${uid}/`;
  const fileName = upload.path.slice(folder.length);
  if (!upload.path.startsWith(folder) || !/^[A-Za-z0-9._-]{1,100}$/.test(fileName)) {
    return null;
  }
  return getBucket().file(upload.path);
};

// Checks an uploaded inbox file and moves it to its permanent place.
// upload: { path, name } as sent by the browser.
// Resolves with the details to save on the reviewer, or throws a 4xx error.
const claimPendingFile = async (uid, upload) => {
  const pendingFile = findPendingFile(uid, upload);
  if (!pendingFile) {
    throw createHttpError(400, 'Choose a file to upload.', { file: 'Choose a file to upload.' });
  }

  const allowedType = findAllowedType(upload.name);
  if (!allowedType) {
    throw createHttpError(
      415,
      'That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file.',
      { file: TYPE_NOT_ALLOWED }
    );
  }

  let metadata;
  try {
    const result = await pendingFile.getMetadata();
    metadata = result[0];
  } catch (err) {
    const message = 'The uploaded file could not be found. Please choose it again.';
    throw createHttpError(400, message, { file: message });
  }

  if (metadata.contentType !== allowedType.mime) {
    throw createHttpError(
      415,
      'That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file.',
      { file: TYPE_NOT_ALLOWED }
    );
  }
  const fileSize = Number(metadata.size);
  if (fileSize > env.maxFileSizeMb * 1024 * 1024) {
    const message = `That file is too large. The limit is ${env.maxFileSizeMb} MB.`;
    throw createHttpError(413, message, { file: message });
  }

  // The stored name is random and never comes from the visitor, so a tricky
  // name such as "../../index.js" cannot escape the reviewers folder.
  const storedName = `${crypto.randomBytes(16).toString('hex')}${allowedType.extension}`;
  await pendingFile.move(getStoredFile(storedName));

  return {
    storedName: storedName,
    fileName: cleanOriginalName(upload.name),
    // Save the content type from our own allowlist, not the one the browser claimed.
    fileMime: allowedType.mime,
    fileSize: fileSize,
  };
};

// Deletes an inbox file that will not be used (the form had a problem).
const removePendingFile = async (uid, upload) => {
  const pendingFile = findPendingFile(uid, upload);
  if (pendingFile) {
    await pendingFile.delete({ ignoreNotFound: true });
  }
};

// Deletes a stored file. A missing file is not an error: the goal is "it is gone".
const removeStoredFile = async (storedName) => {
  if (!storedName) {
    return;
  }
  try {
    await getStoredFile(storedName).delete({ ignoreNotFound: true });
  } catch (err) {
    console.error('Could not delete uploaded file:', err.message);
  }
};

// Resolves with the whole stored file as a Buffer, or throws a 404 error.
const readStoredFile = async (storedName) => {
  try {
    const result = await getStoredFile(storedName).download();
    return result[0];
  } catch (err) {
    throw createHttpError(404, 'The file for this study reviewer is missing.');
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

// Makes a link that opens the file straight from Cloud Storage for the next 10 minutes.
// mode is 'inline' (show it in the browser) or 'attachment' (always save it).
// The file then travels from Cloud Storage, whose free allowance is much bigger
// than the function's, and it is served from Google's own address, never from ours.
const createFileLink = async (reviewer, mode) => {
  const file = getStoredFile(reviewer.stored_name);
  const result = await file.exists();
  if (!result[0]) {
    throw createHttpError(404, 'The file for this study reviewer is missing.');
  }
  const signed = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + LINK_LIFETIME_MILLISECONDS,
    responseDisposition: buildContentDisposition(mode, reviewer.file_name),
    responseType: reviewer.file_mime,
  });
  return signed[0];
};

// Sends the file through the API itself. Only used with the local emulators,
// which cannot make the links above.
const sendStoredFile = async (res, reviewer, mode) => {
  const buffer = await readStoredFile(reviewer.stored_name);
  // nosniff tells the browser to trust our content type and not guess its own,
  // which stops a disguised file from being run as a web page.
  res.setHeader('Content-Type', reviewer.file_mime);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', buildContentDisposition(mode, reviewer.file_name));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buffer);
};

module.exports = {
  claimPendingFile: claimPendingFile,
  removePendingFile: removePendingFile,
  removeStoredFile: removeStoredFile,
  readStoredFile: readStoredFile,
  createFileLink: createFileLink,
  sendStoredFile: sendStoredFile,
  canMakeFileLinks: !env.isUsingStorageEmulator,
};
