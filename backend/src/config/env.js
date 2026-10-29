// Reads settings from backend/.env once, checks them, and shares them with the app.
// Doing all the checks here means the rest of the code can trust these values.
const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.join(__dirname, '..', '..');

// quiet: true stops dotenv from printing its own banner on every start.
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

const PLACEHOLDER_DATABASE_URL = 'postgres://USER:PASSWORD@HOST:5432/DBNAME';

// Prints a friendly explanation and stops, instead of crashing later
// with a confusing database stack trace.
const stopWithMessage = (lines) => {
  console.error('');
  console.error('Atlas backend cannot start yet.');
  console.error('----------------------------------');
  lines.forEach((line) => {
    console.error(line);
  });
  console.error('');
  process.exit(1);
};

const databaseUrl = (process.env.DATABASE_URL || '').trim();

if (databaseUrl === '' || databaseUrl === PLACEHOLDER_DATABASE_URL) {
  stopWithMessage([
    'DATABASE_URL is missing or is still the placeholder.',
    '',
    'What to do:',
    '  1. Open backend/.env',
    '  2. Replace the DATABASE_URL line with your own Postgres URL, for example:',
    '       DATABASE_URL=postgres://atlas:your-password@localhost:5432/atlas',
    '  3. Run "npm run db:migrate" once to create the tables',
    '  4. Start the server again',
  ]);
}

const firebaseProjectId = (process.env.FIREBASE_PROJECT_ID || '').trim();

if (firebaseProjectId === '') {
  stopWithMessage([
    'FIREBASE_PROJECT_ID is empty.',
    '',
    'What to do:',
    '  1. Open backend/.env',
    '  2. Set FIREBASE_PROJECT_ID to your Firebase project id',
    '     (the same value as VITE_FIREBASE_PROJECT_ID in frontend/.env)',
  ]);
}

const isProduction = process.env.NODE_ENV === 'production';
const emulatorHost = (process.env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();

// Emulator tokens are not signed, so anyone could forge one.
// Refusing to start is safer than silently accepting fake logins in production.
if (isProduction && emulatorHost !== '') {
  stopWithMessage([
    'FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production.',
    '',
    'The Auth emulator is for development only.',
    'Remove the FIREBASE_AUTH_EMULATOR_HOST line from backend/.env on your server.',
  ]);
}

// dotenv loads an empty value as "", and firebase-admin would treat that as "use the emulator".
if (emulatorHost === '') {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

let maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB);
if (!maxFileSizeMb || maxFileSizeMb <= 0) {
  maxFileSizeMb = 10;
}

// How many study reviewers one person may have at a time.
let maxUploadsPerUser = Number(process.env.MAX_UPLOADS_PER_USER);
if (!Number.isInteger(maxUploadsPerUser) || maxUploadsPerUser <= 0) {
  maxUploadsPerUser = 50;
}

// The Gemini key is optional: without it the app still runs, and only the
// "Make flashcards" feature answers that it is not set up yet.
let geminiModel = (process.env.GEMINI_MODEL || '').trim();
if (geminiModel === '') {
  geminiModel = 'gemini-3.5-flash-lite';
}

// How uploads are virus-scanned (see src/utils/virusScan.js): off, daemon, or command.
let clamavMode = (process.env.CLAMAV_MODE || 'off').trim();
if (['off', 'daemon', 'command'].indexOf(clamavMode) === -1) {
  stopWithMessage([
    `CLAMAV_MODE is "${clamavMode}", which is not one of: off, daemon, command.`,
    '',
    'What to do:',
    '  1. Open backend/.env',
    '  2. Set CLAMAV_MODE to daemon (ClamAV service running) or command (clamscan per upload)',
  ]);
}
if (isProduction && clamavMode === 'off') {
  console.warn('Warning: CLAMAV_MODE is off, so uploads are not virus-scanned.');
}

module.exports = {
  backendRoot: backendRoot,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: databaseUrl,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  firebaseProjectId: firebaseProjectId,
  isUsingAuthEmulator: emulatorHost !== '',
  frontendOrigin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').trim(),
  // path.resolve turns "./uploads" into a full path, so it does not depend on
  // which folder the server was started from.
  uploadDir: path.resolve(backendRoot, process.env.UPLOAD_DIR || './uploads'),
  maxFileSizeMb: maxFileSizeMb,
  maxUploadsPerUser: maxUploadsPerUser,
  trustProxy: process.env.TRUST_PROXY === 'true',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: geminiModel,
  clamavMode: clamavMode,
  // The Ubuntu/Debian ClamAV service listens here by default.
  clamavSocket: (process.env.CLAMAV_SOCKET || '/var/run/clamav/clamd.ctl').trim(),
  isProduction: isProduction,
};
