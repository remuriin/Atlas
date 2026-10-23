// Turns a stored study reviewer file into "parts" that Gemini can read.
//   PDF, PNG, JPG:  sent as the file itself (Gemini reads these directly)
//   TXT:            sent as text
//   DOCX:           the text is pulled out with mammoth
//   PPTX:           the text of each slide is pulled out with jszip
//   DOC, PPT:       old binary formats that cannot be read; the person is told why
const fs = require('fs');
const JSZip = require('jszip');
const mammoth = require('mammoth');
const upload = require('../middleware/upload');
const createHttpError = require('./httpError');

// Very long text is cut here. It is far more than enough for 30 flashcards and
// keeps every request small and quick.
const MAX_TEXT_CHARACTERS = 200000;

const DIRECT_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const OLD_OFFICE_MIME_TYPES = ['application/msword', 'application/vnd.ms-powerpoint'];

// "&amp;" and friends appear in slide XML; turn the common ones back into characters.
const decodeXmlText = (text) => {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
};

// Reads the visible text of every slide, in slide order ("slide2" before "slide10").
const readPptxText = async (fileBuffer) => {
  const zip = await JSZip.loadAsync(fileBuffer);
  const slideNames = Object.keys(zip.files).filter((name) => {
    return /^ppt\/slides\/slide[0-9]+\.xml$/.test(name);
  });
  slideNames.sort((a, b) => {
    return Number(a.replace(/[^0-9]/g, '')) - Number(b.replace(/[^0-9]/g, ''));
  });

  const slideTexts = [];
  for (const slideName of slideNames) {
    const xml = await zip.file(slideName).async('string');
    // Text on a slide sits inside <a:t> ... </a:t> tags.
    const pieces = [];
    const pattern = /<a:t>([^<]*)<\/a:t>/g;
    let match = pattern.exec(xml);
    while (match) {
      pieces.push(decodeXmlText(match[1]));
      match = pattern.exec(xml);
    }
    slideTexts.push(`Slide ${slideTexts.length + 1}: ${pieces.join(' ')}`);
  }
  return slideTexts.join('\n');
};

const readTextOf = async (reviewer, fileBuffer) => {
  if (reviewer.file_mime === 'text/plain') {
    return fileBuffer.toString('utf8');
  }
  if (reviewer.file_mime === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }
  return readPptxText(fileBuffer);
};

// Returns a list of Gemini parts, for example [{ text: '...' }] or
// [{ inlineData: { mimeType: 'application/pdf', data: '<base64>' } }].
const buildMaterialParts = async (reviewer) => {
  if (OLD_OFFICE_MIME_TYPES.indexOf(reviewer.file_mime) !== -1) {
    throw createHttpError(
      415,
      'Flashcards cannot be made from old .doc or .ppt files. Ask the uploader for a PDF, DOCX, or PPTX version.'
    );
  }

  let fileBuffer;
  try {
    fileBuffer = await fs.promises.readFile(upload.getStoredFilePath(reviewer.stored_name));
  } catch (err) {
    throw createHttpError(404, 'The file for this study reviewer is missing.');
  }

  if (DIRECT_MIME_TYPES.indexOf(reviewer.file_mime) !== -1) {
    return [{ inlineData: { mimeType: reviewer.file_mime, data: fileBuffer.toString('base64') } }];
  }

  let text = '';
  try {
    text = await readTextOf(reviewer, fileBuffer);
  } catch (err) {
    throw createHttpError(422, 'This file could not be read. It may be damaged.');
  }

  text = text.trim();
  if (text === '') {
    throw createHttpError(422, 'There is no readable text in this file to make flashcards from.');
  }
  return [{ text: text.slice(0, MAX_TEXT_CHARACTERS) }];
};

module.exports = {
  buildMaterialParts: buildMaterialParts,
};
