// Creates the tables by running db/schema.sql.
// Usage: npm run db:migrate   (safe to run more than once, and run it again after
// pulling changes: new tables are added and existing ones are left alone)
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const createPool = require('../src/config/createPool');

// Creating and changing tables needs their owner, not the API's limited user.
const pool = createPool(env.migrationDatabaseUrl);

// Turns the most common connection problems into a plain next step.
const explainError = (err) => {
  const code = err.code || '';
  if (code === 'ECONNREFUSED') {
    return 'The server was reached, but nothing is listening on that address and port. Check listen_addresses in postgresql.conf and the port in DATABASE_URL.';
  }
  if (code === 'ETIMEDOUT' || err.message.includes('timeout')) {
    return 'No answer from the server. A firewall is probably blocking the port, or the host in DATABASE_URL is not reachable from this computer.';
  }
  if (code === 'ENOTFOUND') {
    return 'The host name in DATABASE_URL could not be found. Check it for typing mistakes.';
  }
  if (code === '28000') {
    return 'Postgres refused this computer or user. Add a matching line to pg_hba.conf on the server, then reload Postgres.';
  }
  if (code === '28P01') {
    return 'The user name or password in DATABASE_URL is not correct.';
  }
  if (code === '3D000') {
    return 'That database does not exist yet. Create it on the server, or fix the name at the end of DATABASE_URL.';
  }
  if (code === '42501') {
    return 'This user is not allowed to create or change tables. Set MIGRATION_DATABASE_URL in backend/.env to the user that owns the tables (in production, not the limited user the API uses).';
  }
  return 'Check that DATABASE_URL in backend/.env is correct and that Postgres is running.';
};

const runMigration = async () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  try {
    // The file has no user input in it, so it can be sent as one block of SQL.
    await pool.query(schemaSql);
    console.log('Database is ready: all tables and indexes exist.');
  } catch (err) {
    // Some connection errors have an empty message, so the error code is printed too.
    console.error('Migration failed:', err.message || '(no message)', `[code: ${err.code || 'none'}]`);
    console.error(explainError(err));
    process.exitCode = 1;
  }

  await pool.end();
};

runMigration();
