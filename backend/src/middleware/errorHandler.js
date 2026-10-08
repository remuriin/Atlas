// The last stop for every request that went wrong.
// Every error leaves the API in the same shape: an "error" object holding a "message".
const multer = require('multer');
const env = require('../config/env');

// Runs when no route matched the address.
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { message: 'That address does not exist on this API.' } });
};

// Turns upload problems reported by multer into a status code and a plain message.
const describeUploadError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = `That file is too large. The limit is ${env.maxFileSizeMb} MB.`;
    return { status: 413, message: message, fields: { file: message } };
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return { status: 400, message: 'Upload one file at a time, in the "file" field.' };
  }
  return { status: 400, message: 'The upload could not be read. Please try again.' };
};

// Express knows this is an error handler because it has four parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let fields = null;

  if (err instanceof multer.MulterError) {
    const uploadError = describeUploadError(err);
    status = uploadError.status;
    message = uploadError.message;
    fields = uploadError.fields || null;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'The request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request could not be read. Check that it is valid.';
  } else if (err.status && err.status >= 400 && err.status < 500) {
    // An error we created on purpose with createHttpError, so its message is safe to show.
    status = err.status;
    message = err.message;
    fields = err.fields || null;
  }

  if (status === 500) {
    // Log the details for the developer, but never send them to the visitor.
    console.error(err);
  }

  const body = { error: { message: message } };
  if (fields) {
    body.error.fields = fields;
  }
  // Extra detail helps while developing; it is never included in production.
  if (status === 500 && !env.isProduction) {
    body.error.detail = err.message;
  }

  res.status(status).json(body);
};

module.exports = {
  notFoundHandler: notFoundHandler,
  errorHandler: errorHandler,
};
