// Reads a KEY=VALUE settings file (docs/.env). Lines starting with # are comments.
const fs = require('fs');

function read(file) {
  const settings = {};
  if (!fs.existsSync(file)) {
    return settings;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    settings[line.slice(0, eq).trim()] = value;
  }
  return settings;
}

module.exports = {
  read: read,
};
