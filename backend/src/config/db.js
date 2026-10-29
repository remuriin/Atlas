// One shared connection pool for the whole app, connected as DATABASE_URL's user.
// In production that user may only read and change rows (see db/api-user.sql).
const env = require('./env');
const createPool = require('./createPool');

module.exports = createPool(env.databaseUrl);
