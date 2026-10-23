// One-time copy of the old Postgres data and uploaded files into Firestore and Cloud Storage.
//
// Usage (from the backend folder):
//   node scripts/import-postgres-export.js <export folder> --project <id> --bucket <name>
//     --utc-offset <+hh:mm> [--dry-run]
//
// The export folder holds one JSON file per table, made on the old server with
//   psql -At -c "SELECT COALESCE(json_agg(t), '[]') FROM <table> t" > <table>.json
// (users, reviewers, upvotes, recently_viewed, saved_items, flashcards),
// plus an "uploads" folder with the uploaded files.
//
// --utc-offset is the old server's time zone (psql: SHOW timezone), for example +00:00
// for UTC or +08:00 for Asia/Manila. The old tables stored local times without a zone.
// --dry-run only reads and checks everything and prints what it WOULD copy.
// Running it twice is safe: every document has a fixed name, so it is overwritten,
// never doubled. Ids stay the same numbers, so old links keep working.
//
// Logging in: set GOOGLE_APPLICATION_CREDENTIALS to a service account key file, or set
// FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST to copy into the emulators.
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const TABLES = ['users', 'reviewers', 'upvotes', 'recently_viewed', 'saved_items', 'flashcards'];

// Reads "--name value" from the command line. Returns '' when it is missing.
const readOption = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return '';
  }
  return process.argv[index + 1];
};

const stop = (message) => {
  console.error(message);
  process.exit(1);
};

// Postgres TIMESTAMP values have no time zone: they are the old server's local time.
// Adding the server's offset (from --utc-offset) turns them into the right moment.
let utcOffset = '';

const toDate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  let text = String(value);
  if (!/(Z|[+-][0-9]{2}:?[0-9]{2})$/.test(text)) {
    text = `${text}${utcOffset}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    stop(`Could not read the date "${value}".`);
  }
  return date;
};

const readTable = (folder, table) => {
  const filePath = path.join(folder, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    stop(`Missing ${filePath}. Export every table first.`);
  }
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(rows)) {
    stop(`${filePath} does not hold a list of rows.`);
  }
  return rows;
};

const highestId = (rows) => {
  let highest = 0;
  rows.forEach((row) => {
    if (row.id > highest) {
      highest = row.id;
    }
  });
  return highest;
};

const run = async () => {
  const folder = process.argv[2];
  const projectId = readOption('--project');
  const bucketName = readOption('--bucket');
  const isDryRun = process.argv.indexOf('--dry-run') !== -1;
  utcOffset = readOption('--utc-offset');

  if (!folder || folder.startsWith('--') || projectId === '' || bucketName === '') {
    stop(
      'Usage: node scripts/import-postgres-export.js <export folder> --project <id> --bucket <name> --utc-offset <+hh:mm> [--dry-run]'
    );
  }
  if (!/^[+-][0-9]{2}:[0-9]{2}$/.test(utcOffset)) {
    stop('Give the old server time zone, for example --utc-offset +00:00 (UTC) or +08:00.');
  }

  const data = {};
  TABLES.forEach((table) => {
    data[table] = readTable(folder, table);
  });

  // --- Work out everything that will be written, and check it hangs together ---
  const usersById = {};
  data.users.forEach((user) => {
    usersById[user.id] = user;
  });

  const upvoteCounts = {};
  data.upvotes.forEach((upvote) => {
    upvoteCounts[upvote.reviewer_id] = (upvoteCounts[upvote.reviewer_id] || 0) + 1;
  });

  const flashcardCounts = {};
  data.flashcards.forEach((card) => {
    flashcardCounts[card.saved_item_id] = (flashcardCounts[card.saved_item_id] || 0) + 1;
  });

  const uploadsFolder = path.join(folder, 'uploads');
  const missingFiles = [];
  data.reviewers.forEach((reviewer) => {
    if (!usersById[reviewer.author_id]) {
      stop(`Reviewer ${reviewer.id} has an author (${reviewer.author_id}) that is not in users.json.`);
    }
    if (!fs.existsSync(path.join(uploadsFolder, reviewer.stored_name))) {
      missingFiles.push(`${reviewer.id}: ${reviewer.stored_name}`);
    }
  });

  if (isDryRun) {
    console.log('DRY RUN: nothing will be written.');
  } else {
    console.log('Copying...');
  }
  console.log(`  users            ${data.users.length}`);
  console.log(`  reviewers        ${data.reviewers.length}`);
  console.log(`  upvotes          ${data.upvotes.length}`);
  console.log(`  recently viewed  ${data.recently_viewed.length}`);
  console.log(`  saved items      ${data.saved_items.length}`);
  console.log(`  flashcards       ${data.flashcards.length}`);
  console.log(`  files            ${data.reviewers.length - missingFiles.length} found`);
  if (missingFiles.length > 0) {
    console.log(`  MISSING files (the reviewer is still copied): ${missingFiles.join(', ')}`);
  }
  if (isDryRun) {
    return;
  }

  // With no key given here, firebase-admin uses GOOGLE_APPLICATION_CREDENTIALS
  // (or the emulators, when their addresses are set).
  const app = initializeApp({
    projectId: projectId,
    storageBucket: bucketName,
  });
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();
  const writer = db.bulkWriter();

  data.users.forEach((user) => {
    writer.set(db.collection('users').doc(user.firebase_uid), {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      createdAt: toDate(user.created_at),
    });
  });

  data.reviewers.forEach((reviewer) => {
    writer.set(db.collection('reviewers').doc(String(reviewer.id)), {
      authorId: reviewer.author_id,
      authorName: usersById[reviewer.author_id].display_name,
      title: reviewer.title,
      description: reviewer.description,
      subject: reviewer.subject,
      tags: reviewer.tags || '',
      fileName: reviewer.file_name,
      storedName: reviewer.stored_name,
      fileMime: reviewer.file_mime,
      fileSize: reviewer.file_size,
      upvoteCount: upvoteCounts[reviewer.id] || 0,
      createdAt: toDate(reviewer.created_at),
      updatedAt: toDate(reviewer.updated_at),
    });
  });

  data.upvotes.forEach((upvote) => {
    writer.set(db.collection('upvotes').doc(`${upvote.reviewer_id}_${upvote.user_id}`), {
      reviewerId: upvote.reviewer_id,
      userId: upvote.user_id,
      createdAt: toDate(upvote.created_at),
    });
  });

  data.recently_viewed.forEach((view) => {
    writer.set(db.collection('recentlyViewed').doc(`${view.user_id}_${view.reviewer_id}`), {
      userId: view.user_id,
      reviewerId: view.reviewer_id,
      viewedAt: toDate(view.viewed_at),
    });
  });

  data.saved_items.forEach((saved) => {
    writer.set(db.collection('savedItems').doc(String(saved.id)), {
      userId: saved.user_id,
      reviewerId: saved.reviewer_id,
      title: saved.title,
      subject: saved.subject,
      notes: saved.notes,
      notesFormat: saved.notes_format,
      notesUpdatedAt: toDate(saved.notes_updated_at),
      savedAt: toDate(saved.saved_at),
      flashcardCount: flashcardCounts[saved.id] || 0,
    });
  });

  data.flashcards.forEach((card) => {
    writer.set(db.collection('flashcards').doc(String(card.id)), {
      savedItemId: card.saved_item_id,
      position: card.position,
      front: card.front,
      back: card.back,
      status: card.status,
      createdAt: toDate(card.created_at),
    });
  });

  // New ids carry on after the highest old one, the way Postgres would have.
  writer.set(db.collection('counters').doc('users'), { last: highestId(data.users) });
  writer.set(db.collection('counters').doc('reviewers'), { last: highestId(data.reviewers) });
  writer.set(db.collection('counters').doc('savedItems'), { last: highestId(data.saved_items) });
  writer.set(db.collection('counters').doc('flashcards'), { last: highestId(data.flashcards) });

  await writer.close();
  console.log('Database copied.');

  let copiedFiles = 0;
  for (const reviewer of data.reviewers) {
    const localPath = path.join(uploadsFolder, reviewer.stored_name);
    if (fs.existsSync(localPath)) {
      await bucket.upload(localPath, {
        destination: `reviewers/${reviewer.stored_name}`,
        contentType: reviewer.file_mime,
      });
      copiedFiles += 1;
    }
  }
  console.log(`Files copied: ${copiedFiles}.`);
  console.log('Done.');
};

run().catch((err) => {
  console.error('The copy stopped with an error:', err.message);
  process.exit(1);
});
