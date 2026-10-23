// Reads files out of a ZIP archive using only Node's built-in zlib.
// Word (.docx) and PowerPoint (.pptx) files are ZIP archives full of XML files,
// so this is all that is needed to get at their text, with no extra package.
//
// Only what Office files use is supported: plain ZIP (not ZIP64), files that are
// stored as-is or compressed with "deflate", and no encryption.
const zlib = require('zlib');
const createHttpError = require('./httpError');

const END_OF_DIRECTORY_SIGNATURE = 0x06054b50;
const DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

// The end record is 22 bytes plus a comment of up to 65,535 bytes.
const END_RECORD_SIZE = 22;
const MAX_COMMENT_SIZE = 65535;

const MAX_ENTRIES = 5000;
// A tiny compressed file can unpack into gigabytes (a "zip bomb"). No single
// part of a real study file comes anywhere near this.
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;

const STORED = 0;
const DEFLATE = 8;

const unreadable = () => {
  return createHttpError(422, 'This file could not be read. It may be damaged.');
};

// The end record sits at the very end, after an optional comment, so search backwards.
const findEndRecord = (buffer) => {
  const lowest = Math.max(0, buffer.length - END_RECORD_SIZE - MAX_COMMENT_SIZE);
  for (let offset = buffer.length - END_RECORD_SIZE; offset >= lowest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw unreadable();
};

// Unpacks one entry. Called only for the entries that are actually needed.
const unpackEntry = (buffer, entry) => {
  const localOffset = entry.localHeaderOffset;
  if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw unreadable();
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    throw unreadable();
  }
  const data = buffer.subarray(dataStart, dataEnd);

  if (entry.method === STORED) {
    return data;
  }
  try {
    // maxOutputLength stops unpacking as soon as the limit is passed.
    return zlib.inflateRawSync(data, { maxOutputLength: MAX_UNPACKED_BYTES });
  } catch (err) {
    throw unreadable();
  }
};

// Returns { 'word/document.xml': () => Buffer, ... }. Each value unpacks its file
// only when called, so a large archive costs nothing for the parts not read.
const readZipEntries = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < END_RECORD_SIZE) {
    throw unreadable();
  }

  const endOffset = findEndRecord(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);

  // 0xFFFF and 0xFFFFFFFF mean "look in the ZIP64 record", which Office files never need.
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
    throw unreadable();
  }
  if (entryCount > MAX_ENTRIES) {
    throw unreadable();
  }

  const entries = {};
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== DIRECTORY_ENTRY_SIGNATURE) {
      throw unreadable();
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    // Bit 11 means the name is UTF-8; otherwise it is an old single-byte encoding.
    let nameEncoding = 'latin1';
    if ((flags & 0x0800) !== 0) {
      nameEncoding = 'utf8';
    }
    const name = buffer.toString(nameEncoding, offset + 46, offset + 46 + nameLength);

    const isEncrypted = (flags & 0x0001) !== 0;
    const isSupported = method === STORED || method === DEFLATE;
    if (!isEncrypted && isSupported && !name.endsWith('/')) {
      const entry = {
        method: method,
        compressedSize: compressedSize,
        localHeaderOffset: localHeaderOffset,
      };
      entries[name] = () => unpackEntry(buffer, entry);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

module.exports = {
  readZipEntries: readZipEntries,
};
