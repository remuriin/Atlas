// Fills Atlas with sample data: six sample students and sixteen study reviewers,
// two for each strand. Each reviewer is a PDF in db/seed-files/, long enough for at
// least 10 flashcards, and written for Atlas (not copied from modules or books).
//
// Usage:
//   npm run db:seed
//     Adds the sample data. Does nothing if the sample students are already there.
//   npm run db:seed -- --reset --backup <file.json>
//     First saves every table to <file.json>, then deletes all old data (every
//     reviewer, saved item, note, flashcard, upvote, report, view and rate limit, and
//     every user except admins), then adds the sample data. All in one transaction:
//     if any step fails, nothing is deleted.
//
// The sample students cannot log in: they have no Firebase account. They only own
// the reviewers and upvote each other's.
//
// The PDFs are copied into UPLOAD_DIR under their own names. On the server, copy
// db/seed-files/*.pdf into the server's upload folder too.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const createPool = require('../src/config/createPool');
const { checkFileContents } = require('../src/utils/fileContents');

const SEED_FILES_DIR = path.join(__dirname, 'seed-files');

const USERS = [
  { uid: 'seed-user-1', name: 'Andrea Santos', email: 'andrea.santos@atlas.example' },
  { uid: 'seed-user-2', name: 'Miguel Reyes', email: 'miguel.reyes@atlas.example' },
  { uid: 'seed-user-3', name: 'Bea Villanueva', email: 'bea.villanueva@atlas.example' },
  { uid: 'seed-user-4', name: 'Paolo Cruz', email: 'paolo.cruz@atlas.example' },
  { uid: 'seed-user-5', name: 'Janelle Ramos', email: 'janelle.ramos@atlas.example' },
  { uid: 'seed-user-6', name: 'Carlo Mendoza', email: 'carlo.mendoza@atlas.example' },
];

// "owner" is a position in USERS. "votes" is how many of the other students upvote it.
const REVIEWERS = [
  {
    file: 'seed-rock-cycle.pdf',
    owner: 0,
    votes: 4,
    title: 'The rock cycle and the three rock types',
    description:
      'How igneous, sedimentary, and metamorphic rocks form and turn into each other, with weathering, erosion, and melting explained step by step. Includes rocks you can find in the Philippines.',
    strand: 'All strands',
    grade: '11',
    quarter: '1st',
    subject: 'Earth and Life Science',
    materialType: 'Reviewer',
    tags: 'rocks,rock cycle,geology',
  },
  {
    file: 'seed-random-variables.pdf',
    owner: 1,
    votes: 3,
    title: 'Random variables and probability distributions',
    description:
      'Discrete and continuous random variables, the rules of a probability distribution, and how to get the mean, variance, and standard deviation. One full worked example.',
    strand: 'All strands',
    grade: '11',
    quarter: '3rd',
    subject: 'Statistics and Probability',
    materialType: 'Summary notes',
    tags: 'probability,mean,variance',
  },
  {
    file: 'seed-stoichiometry.pdf',
    owner: 2,
    votes: 5,
    title: 'Stoichiometry: moles, mass, and balanced equations',
    description:
      'The mole, molar mass, mole ratios, limiting and excess reactants, and percent yield, with a worked problem from start to finish.',
    strand: 'STEM',
    grade: '11',
    quarter: '2nd',
    subject: 'General Chemistry 1',
    materialType: 'Reviewer',
    tags: 'stoichiometry,moles,chemistry',
  },
  {
    file: 'seed-conic-sections.pdf',
    owner: 3,
    votes: 2,
    title: 'Conic sections at a glance',
    description:
      'Circles, parabolas, ellipses, and hyperbolas: their standard equations, parts, and how to tell them apart from the general equation.',
    strand: 'STEM',
    grade: '11',
    quarter: '1st',
    subject: 'Pre-Calculus',
    materialType: 'Formula sheet',
    tags: 'conics,parabola,ellipse',
  },
  {
    file: 'seed-accounting-cycle.pdf',
    owner: 4,
    votes: 4,
    title: 'The accounting cycle step by step',
    description:
      'From recording a transaction to the post-closing trial balance, with the debit and credit rules and a small sari-sari store example in pesos.',
    strand: 'ABM',
    grade: '11',
    quarter: '3rd',
    subject: 'Fundamentals of Accountancy, Business and Management 1',
    materialType: 'Reviewer',
    tags: 'accounting cycle,journal,ledger',
  },
  {
    file: 'seed-interest.pdf',
    owner: 5,
    votes: 3,
    title: 'Simple and compound interest',
    description:
      'Principal, rate, and time; the simple and compound interest formulas; compounding periods; and nominal versus effective rate, with peso examples.',
    strand: 'ABM',
    grade: '11',
    quarter: '2nd',
    subject: 'Business Mathematics',
    materialType: 'Practice test',
    tags: 'interest,business math,formulas',
  },
  {
    file: 'seed-1987-constitution.pdf',
    owner: 0,
    votes: 5,
    title: 'The 1987 Constitution and the three branches',
    description:
      'Separation of powers, checks and balances, Congress, the President, the Supreme Court, and the constitutional commissions, explained in plain words.',
    strand: 'HUMSS',
    grade: '12',
    quarter: '1st',
    subject: 'Philippine Politics and Governance',
    materialType: 'Reviewer',
    tags: 'constitution,government,politics',
  },
  {
    file: 'seed-elements-of-fiction.pdf',
    owner: 1,
    votes: 2,
    title: 'Elements of fiction',
    description:
      'Character, setting, plot, conflict, point of view, theme, tone, mood, and symbolism, shown with one short story idea set in the Philippines.',
    strand: 'HUMSS',
    grade: '11',
    quarter: '2nd',
    subject: 'Creative Writing',
    materialType: 'Summary notes',
    tags: 'fiction,plot,creative writing',
  },
  {
    file: 'seed-hazards-risk.pdf',
    owner: 2,
    votes: 3,
    title: 'Hazards, exposure, vulnerability, and disaster risk',
    description:
      'What makes a hazard a disaster, how risk is worked out, the tropical cyclone wind signals, and what to do before, during, and after an earthquake or typhoon.',
    strand: 'GAS',
    grade: '11',
    quarter: '4th',
    subject: 'Disaster Readiness and Risk Reduction',
    materialType: 'Reviewer',
    tags: 'drrr,typhoon,earthquake',
  },
  {
    file: 'seed-art-appreciation.pdf',
    owner: 3,
    votes: 1,
    title: 'Art appreciation: forms, functions, and how to look at a work',
    description:
      'The kinds of art, what art is for, subject versus content versus form, and the four steps of art criticism: describe, analyze, interpret, and judge.',
    strand: 'GAS',
    grade: '12',
    quarter: '1st',
    subject: 'Humanities 1',
    materialType: 'Summary notes',
    tags: 'art,humanities,art criticism',
  },
  {
    file: 'seed-computer-hardware.pdf',
    owner: 4,
    votes: 4,
    title: 'Computer hardware basics',
    description:
      'The parts inside a computer, storage types, ports, ESD safety, the order for assembling a system unit, and basic troubleshooting. For Computer Systems Servicing.',
    strand: 'TVL',
    grade: '11',
    quarter: '1st',
    subject: 'ICT specialization',
    materialType: 'Reviewer',
    tags: 'css,hardware,ict',
  },
  {
    file: 'seed-food-safety.pdf',
    owner: 5,
    votes: 2,
    title: 'Kitchen food safety and sanitation',
    description:
      'Food hazards, the temperature danger zone, cross-contamination, handwashing, FIFO storage, cleaning versus sanitizing, and safe thawing.',
    strand: 'TVL',
    grade: '11',
    quarter: '2nd',
    subject: 'Home Economics specialization',
    materialType: 'Reviewer',
    tags: 'food safety,cookery,sanitation',
  },
  {
    file: 'seed-design-principles.pdf',
    owner: 0,
    votes: 3,
    title: 'Elements and principles of design',
    description:
      'Line, shape, form, space, color, value, and texture, then balance, contrast, emphasis, movement, rhythm, proportion, and unity, and how to use them on a poster.',
    strand: 'Arts and Design',
    grade: '11',
    quarter: '1st',
    subject: 'Arts and Design specialized subject',
    materialType: 'Reviewer',
    tags: 'design,principles,layout',
  },
  {
    file: 'seed-color-theory.pdf',
    owner: 1,
    votes: 2,
    title: 'Color theory for beginners',
    description:
      'The color wheel, hue, value, and saturation, tints and shades, color schemes, RGB versus CMYK, and how color sets a mood.',
    strand: 'Arts and Design',
    grade: '12',
    quarter: '2nd',
    subject: 'Arts and Design specialized subject',
    materialType: 'Summary notes',
    tags: 'color,color wheel,design',
  },
  {
    file: 'seed-fitness-components.pdf',
    owner: 2,
    votes: 3,
    title: 'Components of physical fitness and the FITT principle',
    description:
      'Health-related and skill-related fitness, the FITT principle, overload and progression, warm-up and cool-down, and target heart rate.',
    strand: 'Sports',
    grade: '11',
    quarter: '1st',
    subject: 'Sports specialized subject',
    materialType: 'Reviewer',
    tags: 'fitness,fitt,training',
  },
  {
    file: 'seed-sports-first-aid.pdf',
    owner: 3,
    votes: 4,
    title: 'First aid for common sports injuries',
    description:
      'Sprains and strains, RICE, fractures, cramps, nosebleeds, heat illness, signs of a concussion, the first aid kit, and when to call for help.',
    strand: 'Sports',
    grade: '12',
    quarter: '3rd',
    subject: 'Sports specialized subject',
    materialType: 'Reviewer',
    tags: 'first aid,injuries,safety',
  },
];

// Every table, in an order where nothing still points at a deleted row.
const TABLES = [
  'flashcards',
  'saved_items',
  'reports',
  'upvotes',
  'recently_viewed',
  'reviewers',
  'rate_limits',
  'users',
];

const readArgument = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
};

// Saves every row of every table to a JSON file, then reads it back to check it.
const saveBackup = async (client, backupPath) => {
  const backup = { takenAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    const result = await client.query(`SELECT * FROM ${table}`);
    backup.tables[table] = result.rows;
  }
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  const check = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  for (const table of TABLES) {
    if (check.tables[table].length !== backup.tables[table].length) {
      throw new Error(`The backup of ${table} did not save correctly.`);
    }
    console.log(`Backed up ${table}: ${check.tables[table].length} rows`);
  }
};

const deleteOldData = async (client) => {
  for (const table of TABLES) {
    if (table === 'users') {
      // Admins keep their accounts and their admin role.
      const result = await client.query("DELETE FROM users WHERE role <> 'admin'");
      console.log(`Deleted users (admins kept): ${result.rowCount}`);
    } else {
      const result = await client.query(`DELETE FROM ${table}`);
      console.log(`Deleted ${table}: ${result.rowCount}`);
    }
  }
};

const addSampleData = async (client) => {
  const userIds = [];
  for (const user of USERS) {
    const result = await client.query(
      'INSERT INTO users (firebase_uid, display_name, email) VALUES ($1, $2, $3) RETURNING id',
      [user.uid, user.name, user.email]
    );
    userIds.push(result.rows[0].id);
  }

  fs.mkdirSync(env.uploadDir, { recursive: true });

  for (let i = 0; i < REVIEWERS.length; i++) {
    const reviewer = REVIEWERS[i];
    const buffer = fs.readFileSync(path.join(SEED_FILES_DIR, reviewer.file));

    // The same check every upload goes through.
    const problem = checkFileContents(buffer, '.pdf');
    if (problem) {
      throw new Error(`${reviewer.file}: ${problem}`);
    }
    fs.writeFileSync(path.join(env.uploadDir, reviewer.file), buffer);

    // Spread the posting dates over the last weeks, so the "New" tab has an order.
    const daysAgo = (REVIEWERS.length - i) * 2;
    const fileName = reviewer.file.replace('seed-', '');
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const result = await client.query(
      `INSERT INTO reviewers
         (author_id, title, description, strand, grade, quarter, subject, material_type, tags,
          file_name, stored_name, file_mime, file_size, file_hash, rights_confirmed_at,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               NOW() - make_interval(days => $15), NOW() - make_interval(days => $15),
               NOW() - make_interval(days => $15))
       RETURNING id`,
      [
        userIds[reviewer.owner],
        reviewer.title,
        reviewer.description,
        reviewer.strand,
        reviewer.grade,
        reviewer.quarter,
        reviewer.subject,
        reviewer.materialType,
        reviewer.tags,
        fileName,
        reviewer.file,
        'application/pdf',
        buffer.length,
        fileHash,
        daysAgo,
      ]
    );
    const reviewerId = result.rows[0].id;

    // The students after the owner upvote it, as many as "votes" says.
    for (let v = 1; v <= reviewer.votes; v++) {
      const voter = (reviewer.owner + v) % USERS.length;
      await client.query('INSERT INTO upvotes (reviewer_id, user_id) VALUES ($1, $2)', [
        reviewerId,
        userIds[voter],
      ]);
    }
  }

  console.log(`Added ${USERS.length} sample students and ${REVIEWERS.length} study reviewers.`);
};

const runSeed = async () => {
  const reset = process.argv.includes('--reset');
  const backupPath = readArgument('--backup');
  if (reset && !backupPath) {
    console.error('--reset deletes all old data, so it needs a backup file: --backup <file.json>');
    process.exitCode = 1;
    return;
  }

  // Deleting rows in every table needs the tables' owner.
  const pool = createPool(env.migrationDatabaseUrl);
  const client = await pool.connect();

  try {
    if (reset) {
      await saveBackup(client, path.resolve(backupPath));
    } else {
      const existing = await client.query('SELECT id FROM users WHERE firebase_uid = $1', [
        USERS[0].uid,
      ]);
      if (existing.rows.length > 0) {
        console.log('Sample data is already there. Nothing to do.');
        return;
      }
    }

    await client.query('BEGIN');
    if (reset) {
      await deleteOldData(client);
    }
    await addSampleData(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seeding failed, nothing was changed:', err.message);
    console.error('Did you run "npm run db:migrate" first?');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

runSeed();
