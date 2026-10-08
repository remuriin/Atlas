// Makes an Error that carries an HTTP status code.
// Controllers throw these, and the central error handler turns them into replies.
const createHttpError = (status, message, fields) => {
  const err = new Error(message);
  err.status = status;
  // "fields" is optional: an object such as { title: 'Enter a title.' }
  // so the frontend can show each message next to the right input.
  if (fields) {
    err.fields = fields;
  }
  return err;
};

module.exports = createHttpError;
