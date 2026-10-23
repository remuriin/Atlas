// Adds a demo user and a few sample study reviewers to the LOCAL EMULATORS, for demos.
// Usage (from the backend folder, while "npm run serve" is running in another terminal):
//   npm run seed
// It refuses to run unless the emulator addresses are set, so it can never touch
// the live database.
const crypto = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

// The addresses from firebase.json. Set here so "npm run seed" needs no extra setup.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
}

const PROJECT_ID = 'demo-learnhub';
const SEED_FIREBASE_UID = 'seed-demo-user';

const SAMPLES = [
  {
    title: 'Intro to Calculus: Limits and Derivatives',
    description: 'A short reviewer covering limit laws, the definition of the derivative, and the basic differentiation rules, with worked examples.',
    subject: 'Mathematics',
    tags: 'calculus,midterm,derivatives',
  },
  {
    title: 'Cell Biology Cheat Sheet',
    description: 'Organelles and what they do, mitosis versus meiosis, and a one-page summary of cellular respiration.',
    subject: 'Science',
    tags: 'biology,cells,finals',
  },
  {
    title: 'Big-O Notation Quick Guide',
    description: 'Common time complexities explained in plain words, with examples for arrays, hash maps, and sorting algorithms.',
    subject: 'Computer Science',
    tags: 'algorithms,big-o,interviews',
  },
  {
    title: 'World War II Timeline',
    description: 'Key events from 1939 to 1945 in order, with the causes and outcomes you are most likely to be asked about.',
    subject: 'History',
    tags: 'ww2,timeline',
  },
  {
    title: 'Algebra Formula Sheet',
    description: 'Factoring patterns, the quadratic formula, exponent and logarithm rules, and the common mistakes to watch for.',
    subject: 'Mathematics',
    tags: 'algebra,formulas',
  },
  {
    title: 'Statistics Basics: Mean, Median, and Standard Deviation',
    description: 'Plain-language definitions with one worked example each, plus when to use the mean and when the median is the better choice.',
    subject: 'Mathematics',
    tags: 'statistics,probability,quiz',
  },
  {
    title: 'Periodic Table Trends',
    description: 'Atomic radius, ionization energy, and electronegativity explained with arrows across periods and down groups.',
    subject: 'Science',
    tags: 'chemistry,periodic-table',
  },
  {
    title: "Newton's Laws of Motion Summary",
    description: 'The three laws in one page, with everyday examples and the free-body diagram steps for solving force problems.',
    subject: 'Science',
    tags: 'physics,forces,midterm',
  },
  {
    title: 'Essay Writing Checklist',
    description: 'How to build a thesis statement, structure body paragraphs, and proofread, written as a checklist you can tick off.',
    subject: 'English',
    tags: 'essay,writing',
  },
  {
    title: 'Figures of Speech with Examples',
    description: 'Simile, metaphor, personification, hyperbole, irony, and more, each with a short definition and two example sentences.',
    subject: 'English',
    tags: 'literature,grammar',
  },
  {
    title: 'Philippine History: Key Dates and Events',
    description: 'A timeline from the pre-colonial period to the present, with the people and events most often asked about in exams.',
    subject: 'History',
    tags: 'philippines,timeline,finals',
  },
  {
    title: 'Branches of Government Explained',
    description: 'What the executive, legislative, and judicial branches do, and how checks and balances keep each one in line.',
    subject: 'Social Studies',
    tags: 'civics,government',
  },
  {
    title: 'Supply and Demand in One Page',
    description: 'The two curves, what shifts them, and how to read equilibrium price and quantity from a graph.',
    subject: 'Social Studies',
    tags: 'economics,graphs',
  },
  {
    title: 'SQL Basics Cheat Sheet',
    description: 'SELECT, INSERT, UPDATE, DELETE, WHERE, ORDER BY, and simple joins, each with a short example query.',
    subject: 'Computer Science',
    tags: 'sql,databases',
  },
  {
    title: 'Git Commands for Beginners',
    description: 'The everyday commands for saving work, branching, and undoing mistakes, with a short note on what each one does.',
    subject: 'Computer Science',
    tags: 'git,version-control',
  },
  {
    title: 'Statics: Free-Body Diagrams Step by Step',
    description: 'A repeatable method for drawing free-body diagrams and writing equilibrium equations, with two solved beam problems.',
    subject: 'Engineering',
    tags: 'statics,mechanics',
  },
  {
    title: "Ohm's Law and Basic Circuits",
    description: 'Voltage, current, and resistance, series versus parallel circuits, and practice problems with answers.',
    subject: 'Engineering',
    tags: 'circuits,electronics,quiz',
  },
  {
    title: 'Accounting Equation and Journal Entries',
    description: 'Assets equal liabilities plus equity, the debit and credit rules, and ten sample transactions recorded step by step.',
    subject: 'Business',
    tags: 'accounting,basics',
  },
  {
    title: 'Human Anatomy: Body Systems Overview',
    description: 'The eleven body systems, their main organs, and one sentence on what each system does for the body.',
    subject: 'Health and Medicine',
    tags: 'anatomy,nursing',
  },
  {
    title: 'Spanish Verb Conjugation Tables',
    description: 'Present, past, and future tense endings for regular verbs, plus the irregular verbs you will meet most often.',
    subject: 'Languages',
    tags: 'spanish,verbs,grammar',
  },
];

const runSeed = async () => {
  // "demo-" projects only ever exist in the emulators, never on Google's servers.
  const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();

  // Look for the demo user so running the seed twice does not add duplicates.
  const existing = await db.collection('users').doc(SEED_FIREBASE_UID).get();
  if (existing.exists) {
    console.log('Sample data is already there. Nothing to do.');
    return;
  }

  // Reserve ids the same way the API does (see src/models/countersModel.js).
  const takeIds = async (name, howMany) => {
    const ref = db.collection('counters').doc(name);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      let last = 0;
      if (snapshot.exists) {
        last = snapshot.get('last');
      }
      transaction.set(ref, { last: last + howMany });
      return last + 1;
    });
  };

  // Add the demo author.
  const authorId = await takeIds('users', 1);
  await db.collection('users').doc(SEED_FIREBASE_UID).set({
    id: authorId,
    displayName: 'LearnHub Demo',
    email: 'demo@learnhub.example',
    createdAt: new Date(),
  });

  const firstId = await takeIds('reviewers', SAMPLES.length);
  for (let index = 0; index < SAMPLES.length; index += 1) {
    const sample = SAMPLES[index];
    // Each sample gets a small real text file, so "Download" works in the demo.
    const storedName = `${crypto.randomBytes(16).toString('hex')}.txt`;
    const fileText = `${sample.title}\n\n${sample.description}\n\n(Sample file created by npm run seed.)\n`;
    await bucket.file(`reviewers/${storedName}`).save(fileText, { contentType: 'text/plain' });

    // Each one is a second older than the one before, so "New" shows them in list order.
    const createdAt = new Date(Date.now() - index * 1000);
    await db
      .collection('reviewers')
      .doc(String(firstId + index))
      .set({
        authorId: authorId,
        authorName: 'LearnHub Demo',
        title: sample.title,
        description: sample.description,
        subject: sample.subject,
        tags: sample.tags,
        fileName: 'sample-notes.txt',
        storedName: storedName,
        fileMime: 'text/plain',
        fileSize: Buffer.byteLength(fileText),
        upvoteCount: 0,
        createdAt: createdAt,
        updatedAt: createdAt,
      });
  }

  console.log(`Added ${SAMPLES.length} sample study reviewers.`);
};

runSeed().catch((err) => {
  console.error('Seeding failed:', err.message);
  console.error('Are the emulators running? Start them with "npm run serve" first.');
  process.exitCode = 1;
});
