// The file Cloud Functions loads. The whole Express app runs as ONE function
// called "api", so every address under /api works the same as on the old server.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const app = require('./app');

// The Gemini key lives in Google Secret Manager, never in a file in this project.
// Set it once with: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret('GEMINI_API_KEY');

exports.api = onRequest(
  {
    // us-central1 is one of the regions with free Cloud Storage, so everything sits together.
    region: 'us-central1',
    // One copy of the server at most. This keeps the rate limits (which are counted in
    // memory) correct, and it caps how much the function could ever cost.
    maxInstances: 1,
    // That one copy still handles up to 80 requests at the same time.
    concurrency: 80,
    cpu: 1,
    memory: '512MiB',
    // Writing up to 100 flashcards can take a while.
    timeoutSeconds: 180,
    secrets: [geminiApiKey],
  },
  app
);
