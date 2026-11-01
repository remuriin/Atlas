// Stops server details that must stay private from reaching the public docs, the
// built page or Rem. The repo is public, so this runs on every docs file, every data
// file and on the finished page (with the chat key taken out first).
const fs = require('fs');
const path = require('path');

const RULES = [
  { name: 'private IPv4 address', pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})\b/ },
  { name: 'the server address in dotted form (use the api.140-245-60-8.sslip.io name)', pattern: /\b140\.245\.60\.8\b/ },
  { name: 'network range (CIDR)', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}\b/ },
  // ClamAV's standard socket (/var/run/clamav/...) is a public default, so it is allowed
  { name: 'server file path', pattern: /(^|[\s`'"(])\/(var(?!\/run\/clamav\/)|etc|home|root|opt|srv)\//m },
  { name: 'login name on the server', pattern: /\bubuntu@/ },
  { name: 'SSH command', pattern: /(^|[\s`])ssh\s+[\w.@-]/m },
  { name: 'Rem RaaS key', pattern: /\brag_[A-Za-z0-9_-]{20,}/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{20,}/ },
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // placeholders written in capitals (USER:PASSWORD, postgres:LOCAL_PASSWORD) are allowed
  { name: 'database URL with a password', pattern: /postgres(ql)?:\/\/[^\s:@/]+:(?![A-Z][A-Z_]*@)[^\s@/]+@/ },
];

// Extra exact strings kept in the gitignored private folder (one per line).
function privateStrings(docsDir) {
  const file = path.join(docsDir, 'private', 'denylist.txt');
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(function (line) {
    return line.trim();
  }).filter(function (line) {
    return line !== '' && !line.startsWith('#');
  });
}

// Returns a list of problems ("where: what") for one text.
function scan(text, where, extra) {
  const problems = [];
  for (let i = 0; i < RULES.length; i++) {
    const match = text.match(RULES[i].pattern);
    if (match) {
      problems.push(where + ': ' + RULES[i].name + ' ("' + match[0].trim().slice(0, 40) + '")');
    }
  }
  for (let j = 0; j < extra.length; j++) {
    if (text.indexOf(extra[j]) !== -1) {
      problems.push(where + ': a string from docs/private/denylist.txt');
    }
  }
  return problems;
}

module.exports = {
  scan: scan,
  privateStrings: privateStrings,
};
