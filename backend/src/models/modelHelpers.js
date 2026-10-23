// Small helpers shared by the model files.
const { Timestamp } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');

// Firestore hands dates back as Timestamps. Turning them into ordinary JavaScript
// dates keeps every reply in the same format as before (for example "2026-10-23T08:00:00.000Z").
const toDate = (value) => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value === undefined) {
    return null;
  }
  return value;
};

// Deletes every document a query finds. A BulkWriter sends the deletes in
// efficient groups, so this works for any number of documents.
const deleteAllFound = async (query) => {
  const snapshot = await query.get();
  const writer = db.bulkWriter();
  snapshot.docs.forEach((doc) => {
    writer.delete(doc.ref);
  });
  await writer.close();
};

// Changes the same fields on every document a query finds.
const updateAllFound = async (query, changes) => {
  const snapshot = await query.get();
  const writer = db.bulkWriter();
  snapshot.docs.forEach((doc) => {
    writer.update(doc.ref, changes);
  });
  await writer.close();
};

module.exports = {
  toDate: toDate,
  deleteAllFound: deleteAllFound,
  updateAllFound: updateAllFound,
};
