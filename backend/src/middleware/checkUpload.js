// Runs right after a file is uploaded and before anything is saved about it:
// the file's contents must match its type, and the virus scan must pass.
// A rejected file is deleted at once, so nothing unsafe stays on the disk.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const upload = require('./upload');
const fileContents = require('../utils/fileContents');
const virusScan = require('../utils/virusScan');
const createHttpError = require('../utils/httpError');

const rejectFile = async (req, status, message) => {
  await upload.removeStoredFile(req.file.filename);
  return createHttpError(status, message, { file: message });
};

const checkUpload = async (req, res, next) => {
  // Editing without a new file is fine: there is nothing to check.
  if (!req.file) {
    next();
    return;
  }

  try {
    // Files are at most MAX_FILE_SIZE_MB (10 MB by default), so reading one whole is fine.
    const buffer = await fs.promises.readFile(req.file.path);
    const extension = path.extname(req.file.filename).toLowerCase();

    const problem = fileContents.checkFileContents(buffer, extension);
    if (problem !== '') {
      next(await rejectFile(req, 415, problem));
      return;
    }

    let result;
    try {
      result = await virusScan.scanFile(buffer, req.file.path);
    } catch (err) {
      // If the scanner is down, refuse the upload rather than let it through unscanned.
      console.error('Virus scan failed:', err.message);
      next(
        await rejectFile(
          req,
          503,
          'Uploads are paused because the virus scan is not working. Try again in a few minutes.'
        )
      );
      return;
    }

    if (!result.isClean) {
      console.warn(`Virus scan blocked an upload from user ${req.user.id}: ${result.threat}`);
      next(
        await rejectFile(
          req,
          422,
          'The virus scan flagged this file as unsafe, so it was not uploaded.'
        )
      );
      return;
    }

    // The file's fingerprint, used by the controller to refuse the same file twice.
    req.fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    next();
  } catch (err) {
    await upload.removeStoredFile(req.file.filename);
    next(err);
  }
};

module.exports = checkUpload;
