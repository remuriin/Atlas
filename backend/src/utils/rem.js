// Passes a question about Atlas on to Rem, the docs chat service (Rem RaaS), and returns
// its answer. The Atlas Explorer asks through here, so the Rem key stays on this server
// and never reaches a browser. It uses plain fetch (built into Node 20).
const env = require('../config/env');
const createHttpError = require('./httpError');

// Rem looks up the docs and has Gemini write the answer, which can take a while.
const TIMEOUT_MS = 60 * 1000;

const SERVICE_ERROR_MESSAGE = 'Rem did not answer. Please try again in a moment.';

// question: a string. history: [{ role, content }], already checked by the controller.
// Resolves with { answer, sources, answered }.
const askRem = async (question, history) => {
  if (env.raasUrl === '' || env.raasKey === '') {
    throw createHttpError(503, 'The docs chat is not set up on this server yet.');
  }

  let response;
  try {
    response = await fetch(`${env.raasUrl}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.raasKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question, history: history, topK: 6, markdown: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('Rem request failed:', err.message);
    throw createHttpError(502, SERVICE_ERROR_MESSAGE);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    let detail = '';
    if (data && data.error) {
      detail = String(data.error);
    }
    console.error(`Rem answered ${response.status}:`, detail);
    if (response.status === 429 || response.status === 503) {
      throw createHttpError(503, 'Rem is busy right now. Please try again in a moment.');
    }
    throw createHttpError(502, SERVICE_ERROR_MESSAGE);
  }

  if (!data || typeof data.answer !== 'string') {
    throw createHttpError(502, SERVICE_ERROR_MESSAGE);
  }

  // Only the fields the explorer shows are passed on.
  const sources = [];
  if (Array.isArray(data.sources)) {
    data.sources.forEach((source) => {
      if (source && typeof source.source === 'string') {
        sources.push({ source: source.source, heading: String(source.heading || '') });
      }
    });
  }
  return { answer: data.answer, sources: sources, answered: data.answered !== false };
};

module.exports = {
  askRem: askRem,
};
