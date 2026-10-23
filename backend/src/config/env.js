// Reads the API's settings once, checks them, and shares them with the app.
// Doing all the checks here means the rest of the code can trust these values.
//
// Where the settings come from:
//   live (Cloud Functions):  backend/.env.<project id>, plus the GEMINI_API_KEY secret
//   local (emulators):       backend/.env.local, plus backend/.secret.local
// Firebase loads those files by itself, so no extra package is needed to read them.

// Stops the API with a plain explanation, instead of crashing later
// with a confusing stack trace. The message appears in the function's logs.
const stopWithMessage = (lines) => {
  throw new Error(['LearnHub API cannot start yet.'].concat(lines).join('\n'));
};

// Firebase sets this by itself when the local emulator runs the code.
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
// K_SERVICE is only set on Google's servers (Cloud Run runs the function there).
const isOnGoogleCloud = Boolean(process.env.K_SERVICE) && !isEmulator;

const authEmulatorHost = (process.env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();
const firestoreEmulatorHost = (process.env.FIRESTORE_EMULATOR_HOST || '').trim();
const storageEmulatorHost = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '').trim();

// Emulator logins are not signed, so anyone could forge one.
// Refusing to start is safer than silently accepting fake logins on the live site.
if (isOnGoogleCloud && (authEmulatorHost !== '' || firestoreEmulatorHost !== '' || storageEmulatorHost !== '')) {
  stopWithMessage([
    'An emulator address (FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST or',
    'FIREBASE_STORAGE_EMULATOR_HOST) is set on the live server.',
    'The emulators are for development only. Remove that line from backend/.env.<project id>',
    'and make sure there is no plain backend/.env file, then deploy again.',
  ]);
}

let maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB);
if (!maxFileSizeMb || maxFileSizeMb <= 0) {
  maxFileSizeMb = 10;
}

// The Gemini key is optional: without it the app still runs, and only the
// "Make flashcards" feature answers that it is not set up yet.
let geminiModel = (process.env.GEMINI_MODEL || '').trim();
if (geminiModel === '') {
  geminiModel = 'gemini-3.5-flash-lite';
}

module.exports = {
  isOnGoogleCloud: isOnGoogleCloud,
  isUsingAuthEmulator: authEmulatorHost !== '',
  isUsingStorageEmulator: storageEmulatorHost !== '',
  frontendOrigin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').trim(),
  // Empty means "the project's default bucket".
  storageBucket: (process.env.STORAGE_BUCKET || '').trim(),
  maxFileSizeMb: maxFileSizeMb,
  trustProxy: process.env.TRUST_PROXY === 'true',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: geminiModel,
  // Error details are only added to replies while developing, never on the live site.
  isProduction: isOnGoogleCloud,
};
