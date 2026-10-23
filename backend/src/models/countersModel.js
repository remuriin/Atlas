// Hands out numeric ids (1, 2, 3, ...), the way Postgres SERIAL columns did.
// Keeping numbers means old links such as /reviewers/12 and /saved/7 still work.
// Each kind of item has its own counter document: counters/reviewers, counters/users, ...
const { db } = require('../config/firebase');

// Reserves "howMany" new ids inside a transaction the caller already started, and
// returns the first one. The caller's own reads must come BEFORE this call,
// because Firestore needs every read in a transaction to happen before any write.
const takeIds = async (transaction, name, howMany) => {
  const ref = db.collection('counters').doc(name);
  const snapshot = await transaction.get(ref);
  let last = 0;
  if (snapshot.exists) {
    last = snapshot.get('last');
  }
  transaction.set(ref, { last: last + howMany });
  return last + 1;
};

module.exports = {
  takeIds: takeIds,
};
