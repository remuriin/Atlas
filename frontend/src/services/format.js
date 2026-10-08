// Small helpers that turn raw values into text people can read.
import { getExtension } from './fileRules';

// 1536 -> "1.5 KB"
export const formatFileSize = (bytes) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// "2026-10-08T09:00:00.000Z" -> "Oct 8, 2026" (in the visitor's own language settings)
export const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// "notes.docx" -> "Word document"
export const describeFileType = (fileName) => {
  const extension = getExtension(fileName);
  if (extension === 'pdf') {
    return 'PDF';
  }
  if (extension === 'doc' || extension === 'docx') {
    return 'Word document';
  }
  if (extension === 'ppt' || extension === 'pptx') {
    return 'PowerPoint';
  }
  if (extension === 'txt') {
    return 'Text file';
  }
  return 'Image';
};

// PDFs and images open in the browser; other files are downloaded.
export const opensInBrowser = (fileMime) => {
  return fileMime === 'application/pdf' || fileMime === 'image/png' || fileMime === 'image/jpeg';
};

// 1 -> "1 upvote", 5 -> "5 upvotes"
export const countLabel = (count, singular, plural) => {
  if (count === 1) {
    return `1 ${singular}`;
  }
  return `${count} ${plural}`;
};
