// Checks that an uploaded file really is what its name says.
// The extension and the browser's content type are both chosen by the uploader,
// so a program renamed to "notes.pdf" passes them. The first bytes of a file
// (its "signature") are much harder to fake, and Office files are checked inside.
const zipReader = require('./zipReader');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_SIGNATURE = Buffer.from('%PDF-', 'latin1');
// Some PDF writers put a little junk before "%PDF-"; readers accept up to 1 KB of it.
const PDF_SIGNATURE_SEARCH_BYTES = 1024;

// PDF features that run code or carry hidden files. Study notes do not need them.
// /JS and /JavaScript run scripts, /Launch opens other programs, and
// /EmbeddedFile(s) hide whole files inside the PDF.
const RISKY_PDF_NAMES = /\/(JavaScript|JS|Launch|EmbeddedFiles?)(?![A-Za-z0-9])/;

// The part that proves a ZIP is a real Word or PowerPoint file.
const OFFICE_MAIN_PARTS = {
  '.docx': 'word/document.xml',
  '.pptx': 'ppt/presentation.xml',
};

// Bytes that never appear in a plain text file: NUL and the other control
// characters except tab, line feed, form feed, and carriage return.
const NON_TEXT_BYTE = /[\x00-\x08\x0b\x0e-\x1f]/;

const startsWith = (buffer, signature) => {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
};

const checkPdf = (buffer) => {
  const start = buffer.subarray(0, PDF_SIGNATURE_SEARCH_BYTES);
  if (start.indexOf(PDF_SIGNATURE) === -1) {
    return 'This file is not a real PDF.';
  }
  // latin1 keeps every byte as one character, so names are found anywhere in the file.
  if (RISKY_PDF_NAMES.test(buffer.toString('latin1'))) {
    return 'This PDF contains scripts or attached files, which are not allowed. Print it to a new PDF and upload that one.';
  }
  return '';
};

const checkOffice = (buffer, extension) => {
  let entries;
  try {
    entries = zipReader.readZipEntries(buffer);
  } catch (err) {
    return 'This file is not a real Word or PowerPoint file.';
  }
  const names = Object.keys(entries);
  if (names.indexOf('[Content_Types].xml') === -1 || names.indexOf(OFFICE_MAIN_PARTS[extension]) === -1) {
    return 'This file is not a real Word or PowerPoint file.';
  }
  // vbaProject.bin holds macros: a macro file (.docm, .pptm) renamed to .docx or .pptx.
  if (names.find((name) => name.toLowerCase().endsWith('vbaproject.bin'))) {
    return 'This file contains macros, which are not allowed. Save it as a normal .docx or .pptx, or as a PDF.';
  }
  return '';
};

const checkText = (buffer) => {
  if (NON_TEXT_BYTE.test(buffer.toString('latin1'))) {
    return 'This file is not plain text. If it is text, save it as UTF-8 and try again.';
  }
  return '';
};

// Returns a message describing the problem, or '' when the contents match the extension.
const checkFileContents = (buffer, extension) => {
  if (buffer.length === 0) {
    return 'This file is empty.';
  }
  if (extension === '.pdf') {
    return checkPdf(buffer);
  }
  if (extension === '.docx' || extension === '.pptx') {
    return checkOffice(buffer, extension);
  }
  if (extension === '.png') {
    return startsWith(buffer, PNG_SIGNATURE) ? '' : 'This file is not a real PNG image.';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return startsWith(buffer, JPEG_SIGNATURE) ? '' : 'This file is not a real JPG image.';
  }
  if (extension === '.txt') {
    return checkText(buffer);
  }
  return 'That file type is not allowed.';
};

module.exports = {
  checkFileContents: checkFileContents,
};
