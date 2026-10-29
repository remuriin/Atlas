// Scans uploaded files with ClamAV, the free antivirus most Linux servers use.
// CLAMAV_MODE in backend/.env picks how:
//   off       no scan (the default, for development)
//   daemon    ask the running ClamAV service (clamd) through its socket: fast,
//             but the service keeps about 1 to 1.5 GB of RAM in use
//   command   run "clamscan" once per upload: uses memory only while scanning,
//             but each scan takes 10 to 30 seconds while it loads the virus list
const childProcess = require('child_process');
const net = require('net');
const env = require('../config/env');

const DAEMON_TIMEOUT_MS = 30 * 1000;
const COMMAND_TIMEOUT_MS = 120 * 1000;
// clamd reads a stream in pieces; 64 KB is a comfortable size for each one.
const CHUNK_SIZE = 64 * 1024;

// The answer of every scan: { isClean: true } or { isClean: false, threat: 'name' }.
// When the scanner itself fails, the promise rejects, and the upload is refused.

// clamd's INSTREAM command: send "zINSTREAM\0", then the file as pieces that each
// start with their length (4 bytes), then a length of 0 to say "that is all".
// It answers "stream: OK" or "stream: <threat name> FOUND".
const scanWithDaemon = (buffer) => {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ path: env.clamavSocket });
    let answer = '';

    socket.setTimeout(DAEMON_TIMEOUT_MS);
    socket.on('timeout', () => {
      socket.destroy(new Error('ClamAV did not answer in time.'));
    });
    socket.on('error', reject);

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length, 0);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });

    socket.on('data', (data) => {
      answer += data.toString('utf8');
    });

    socket.on('end', () => {
      const text = answer.replace(/\0/g, '').trim();
      if (text.endsWith(': OK')) {
        resolve({ isClean: true });
      } else if (text.endsWith(' FOUND')) {
        const threat = text.replace(/^stream: /, '').replace(/ FOUND$/, '');
        resolve({ isClean: false, threat: threat });
      } else {
        reject(new Error(`Unexpected ClamAV answer: ${text}`));
      }
    });
  });
};

// clamscan exits with 0 for a clean file, 1 when it found something, and 2 on an error.
const scanWithCommand = (filePath) => {
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      'clamscan',
      ['--no-summary', '--stdout', filePath],
      { timeout: COMMAND_TIMEOUT_MS },
      (err, stdout) => {
        if (!err) {
          resolve({ isClean: true });
          return;
        }
        if (err.code === 1) {
          // The line looks like "/path/to/file: Eicar-Signature FOUND".
          const match = stdout.match(/: (.+) FOUND/);
          resolve({ isClean: false, threat: match ? match[1] : 'unknown' });
          return;
        }
        reject(err);
      }
    );
  });
};

// buffer is the file's contents, filePath where it is stored on disk.
const scanFile = async (buffer, filePath) => {
  if (env.clamavMode === 'daemon') {
    return scanWithDaemon(buffer);
  }
  if (env.clamavMode === 'command') {
    return scanWithCommand(filePath);
  }
  return { isClean: true };
};

module.exports = {
  scanFile: scanFile,
};
