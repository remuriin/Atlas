// One shared connection pool for the whole app.
// A pool reuses a few open connections instead of opening a new one per request.
const { Pool } = require('pg');
const env = require('./env');

let sslSetting = false;
if (env.databaseSsl) {
  // Many self-hosted Postgres servers use a self-signed certificate.
  // This still encrypts the connection; it just does not check who signed the certificate.
  sslSetting = { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: sslSetting,
  max: 10,
  connectionTimeoutMillis: 10000,
});

// Without this listener, an error on an idle connection would crash the process.
pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err.message);
});

module.exports = pool;
