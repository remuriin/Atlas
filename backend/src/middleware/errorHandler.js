// The last stop for every request that went wrong.
// Every error leaves the API in the same shape: an "error" object holding a "message".
const env = require('../config/env');

// Statuses whose message we wrote ourselves: every 4xx, plus 502 and 503, which are
// used when the flashcard service (Gemini) fails or is not set up.
const SAFE_STATUSES = [502, 503];
for (let status = 400; status < 500; status += 1) {
  SAFE_STATUSES.push(status);
}

// Runs when no route matched the address.
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { message: 'That address does not exist on this API.' } });
};

// Express knows this is an error handler because it has four parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let fields = null;

  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'The request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request could not be read. Check that it is valid.';
  } else if (err.status && SAFE_STATUSES.indexOf(err.status) !== -1) {
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
