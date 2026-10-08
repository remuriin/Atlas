// Builds the Express app: security settings first, then routes, then error handling.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const rateLimit = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const reviewersRoutes = require('./routes/reviewersRoutes');
const meRoutes = require('./routes/meRoutes');

const app = express();

// Behind nginx, the visitor's real address arrives in a header.
// Trusting exactly one proxy lets rate limiting count real visitors.
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

// Do not advertise which framework runs the API.
app.disable('x-powered-by');

// helmet adds a set of protective response headers.
app.use(helmet());

// Only our own frontend may call this API from a browser.
app.use(
  cors({
    origin: env.frontendOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  })
);

app.use(rateLimit.generalLimiter);

// Request bodies here are tiny (a display name), so a small limit is plenty.
// File uploads do not pass through this; multer has its own limit.
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/reviewers', reviewersRoutes);
app.use('/api/me', meRoutes);

app.use(errorHandler.notFoundHandler);
app.use(errorHandler.errorHandler);

module.exports = app;
