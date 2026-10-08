// Starts the API. Loading env first means a missing setting is explained
// in plain words before anything else has a chance to fail.
const env = require('./config/env');
const app = require('./app');
const pool = require('./config/db');

const server = app.listen(env.port, () => {
  console.log(`LearnHub API is running on http://localhost:${env.port}`);
  console.log(`Accepting browser requests from ${env.frontendOrigin}`);
  if (env.isUsingAuthEmulator) {
    console.log('Using the Firebase Auth EMULATOR (development only).');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.port} is already in use. Stop the other program or change PORT in backend/.env.`);
  } else {
    console.error('The server could not start:', err.message);
  }
  process.exit(1);
});

// Finish open requests and close database connections when asked to stop.
const shutDown = () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);