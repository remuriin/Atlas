// Adds a demo user and a few sample study reviewers for local demos.
// Usage: npm run db:seed   (never runs automatically)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const pool = require('../src/config/db');

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
  try {
    // Look for the demo user so running the seed twice does not add duplicates.
    const existing = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [
      SEED_FIREBASE_UID,
    ]);
    if (existing.rows.length > 0) {
      console.log('Sample data is already there. Nothing to do.');
      await pool.end();
      return;
    }

    // Add the demo author.
    const userResult = await pool.query(
      'INSERT INTO users (firebase_uid, display_name, email) VALUES ($1, $2, $3) RETURNING id',
      [SEED_FIREBASE_UID, 'Atlas Demo', 'demo@atlas.example']
    );
    const authorId = userResult.rows[0].id;

    fs.mkdirSync(env.uploadDir, { recursive: true });

    for (const sample of SAMPLES) {
      // Each sample gets a small real text file, so "Download" works in the demo.
      const storedName = `${crypto.randomBytes(16).toString('hex')}.txt`;
      const fileText = `${sample.title}\n\n${sample.description}\n\n(Sample file created by npm run db:seed.)\n`;
      fs.writeFileSync(path.join(env.uploadDir, storedName), fileText);

      // Add one sample reviewer.
      await pool.query(
        `INSERT INTO reviewers
           (author_id, title, description, subject, tags, file_name, stored_name, file_mime, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          authorId,
          sample.title,
          sample.description,
          sample.subject,
          sample.tags,
          'sample-notes.txt',
          storedName,
          'text/plain',
          Buffer.byteLength(fileText),
        ]
      );
    }

    console.log(`Added ${SAMPLES.length} sample study reviewers.`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    console.error('Did you run "npm run db:migrate" first?');
    process.exitCode = 1;
  }

  await pool.end();
};

runSeed();
