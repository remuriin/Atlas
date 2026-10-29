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
    title: 'Basic Calculus: Limits and Derivatives',
    description: 'Limit laws, the definition of the derivative, and the basic differentiation rules, with worked examples for the quarterly exam.',
    strand: 'STEM',
    grade: '11',
    quarter: '4th',
    subject: 'Basic Calculus',
    materialType: 'Reviewer',
    tags: 'limits,derivatives',
  },
  {
    title: 'General Chemistry 1: Periodic Table Trends',
    description: 'Atomic radius, ionization energy, and electronegativity explained with arrows across periods and down groups.',
    strand: 'STEM',
    grade: '11',
    quarter: '1st',
    subject: 'General Chemistry 1',
    materialType: 'Summary notes',
    tags: 'periodic-table',
  },
  {
    title: "General Physics 1: Newton's Laws Practice Test",
    description: 'Twenty problems on the three laws of motion and free-body diagrams, with an answer key at the end.',
    strand: 'STEM',
    grade: '12',
    quarter: '1st',
    subject: 'General Physics 1',
    materialType: 'Practice test',
    tags: 'forces,free-body',
  },
  {
    title: 'General Biology 1: Cell Structure Cheat Sheet',
    description: 'Organelles and what they do, mitosis versus meiosis, and a one-page summary of cellular respiration.',
    strand: 'STEM',
    grade: '12',
    quarter: '1st',
    subject: 'General Biology 1',
    materialType: 'Summary notes',
    tags: 'cells,mitosis',
  },
  {
    title: 'Pre-Calculus Formula Sheet',
    description: 'Conic sections, sequences and series, and the trigonometric identities you need, all on one page.',
    strand: 'STEM',
    grade: '11',
    quarter: '1st',
    subject: 'Pre-Calculus',
    materialType: 'Formula sheet',
    tags: 'conics,trigonometry',
  },
  {
    title: 'General Mathematics: Functions and Interest',
    description: 'Functions, inverse and exponential functions, then simple and compound interest with solved examples.',
    strand: 'All strands',
    grade: '11',
    quarter: '1st',
    subject: 'General Mathematics',
    materialType: 'Reviewer',
    tags: 'functions,interest',
  },
  {
    title: 'Statistics and Probability: Normal Distribution',
    description: 'How to read the z-table, find areas under the normal curve, and solve sampling problems step by step.',
    strand: 'All strands',
    grade: '11',
    quarter: '3rd',
    subject: 'Statistics and Probability',
    materialType: 'Reviewer',
    tags: 'z-score,sampling',
  },
  {
    title: 'Oral Communication: Types of Speech',
    description: 'Speech by purpose and by delivery, the communication models, and the speech acts, with short examples.',
    strand: 'All strands',
    grade: '11',
    quarter: '1st',
    subject: 'Oral Communication',
    materialType: 'Summary notes',
    tags: 'speech,communication',
  },
  {
    title: 'Komunikasyon: Mga Konseptong Pangwika',
    description: 'Wika, barayti ng wika, at kasaysayan ng wikang pambansa, na may mga halimbawa para sa pagsusulit.',
    strand: 'All strands',
    grade: '11',
    quarter: '1st',
    subject: 'Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino',
    materialType: 'Reviewer',
    tags: 'wika,filipino',
  },
  {
    title: 'Practical Research 2: Writing Chapter 1',
    description: 'How to write the background, statement of the problem, hypotheses, and scope for a quantitative study.',
    strand: 'All strands',
    grade: '12',
    quarter: '1st',
    subject: 'Practical Research 2',
    materialType: 'Reviewer',
    tags: 'quantitative,research',
  },
  {
    title: 'Earth and Life Science: Rocks and Minerals',
    description: 'The rock cycle, the three rock types, and the properties used to identify minerals.',
    strand: 'All strands',
    grade: '11',
    quarter: '1st',
    subject: 'Earth and Life Science',
    materialType: 'Summary notes',
    tags: 'geology,minerals',
  },
  {
    title: 'Fundamentals of ABM 1: Accounting Equation',
    description: 'Assets equal liabilities plus equity, the debit and credit rules, and ten sample transactions recorded step by step.',
    strand: 'ABM',
    grade: '11',
    quarter: '3rd',
    subject: 'Fundamentals of Accountancy, Business and Management 1',
    materialType: 'Reviewer',
    tags: 'accounting,journal-entries',
  },
  {
    title: 'Business Finance: Financial Ratios',
    description: 'Liquidity, profitability, and solvency ratios, what each one tells you, and practice problems with answers.',
    strand: 'ABM',
    grade: '12',
    quarter: '1st',
    subject: 'Business Finance',
    materialType: 'Practice test',
    tags: 'ratios,finance',
  },
  {
    title: 'Philippine Politics and Governance: Branches of Government',
    description: 'What the executive, legislative, and judicial branches do under the 1987 Constitution, and how checks and balances work.',
    strand: 'HUMSS',
    grade: '11',
    quarter: '2nd',
    subject: 'Philippine Politics and Governance',
    materialType: 'Reviewer',
    tags: 'constitution,government',
  },
  {
    title: 'Creative Writing: Figures of Speech',
    description: 'Simile, metaphor, personification, hyperbole, irony, and more, each with a short definition and two example sentences.',
    strand: 'HUMSS',
    grade: '11',
    quarter: '1st',
    subject: 'Creative Writing',
    materialType: 'Summary notes',
    tags: 'poetry,literature',
  },
  {
    title: 'Disaster Readiness and Risk Reduction: Hazards',
    description: 'Geological and hydrometeorological hazards, their signs, and what to do before, during, and after each one.',
    strand: 'GAS',
    grade: '12',
    quarter: '2nd',
    subject: 'Disaster Readiness and Risk Reduction',
    materialType: 'Reviewer',
    tags: 'hazards,earthquake',
  },
  {
    title: 'Cookery NC II: Kitchen Tools and Sanitation',
    description: 'Kitchen tools and equipment, safe food handling, and cleaning and sanitizing steps for the TVL assessment.',
    strand: 'TVL',
    grade: '11',
    quarter: '1st',
    subject: 'Home Economics specialization',
    materialType: 'Reviewer',
    tags: 'cookery,nc-ii',
  },
  {
    title: 'Computer Systems Servicing: Network Cabling',
    description: 'Straight-through and crossover cables, the T568A and T568B color codes, and how to test a cable.',
    strand: 'TVL',
    grade: '12',
    quarter: '2nd',
    subject: 'ICT specialization',
    materialType: 'Practice test',
    tags: 'css,networking',
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
           (author_id, title, description, strand, grade, quarter, subject, material_type, tags,
            file_name, stored_name, file_mime, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          authorId,
          sample.title,
          sample.description,
          sample.strand,
          sample.grade,
          sample.quarter,
          sample.subject,
          sample.materialType,
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
