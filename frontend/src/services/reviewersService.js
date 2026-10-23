// API calls about study reviewers.
import { API_URL, apiRequest, apiRequestBlob, fetchBlob } from './api';
import { uploadToInbox } from './fileUpload';

// filters: { sort, subject, q, page }
export const listReviewers = (filters) => {
  const params = new URLSearchParams();
  params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  if (filters.subject) {
    params.set('subject', filters.subject);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
  return apiRequest(`/api/reviewers?${params.toString()}`);
};

export const getReviewer = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}`);
};

// A plain link to the file. File reads are public, so no token is needed
// and the link can be opened in a new tab or shared.
// isDownload: true makes the browser save the file instead of showing it.
export const getFileUrl = (reviewerId, isDownload) => {
  if (isDownload) {
    return `${API_URL}/api/reviewers/${reviewerId}/file?download=1`;
  }
  return `${API_URL}/api/reviewers/${reviewerId}/file`;
};

// Gets the file itself as a Blob, for showing it inside the page. The API answers
// with a short-lived link, and the file is then fetched straight from Cloud Storage.
export const fetchReviewerFile = async (reviewerId) => {
  const link = await apiRequest(`/api/reviewers/${reviewerId}/file-link`);
  if (link.url) {
    return fetchBlob(link.url);
  }
  // The local emulators cannot make such links, so there the API sends the file itself.
  return apiRequestBlob(`/api/reviewers/${reviewerId}/file`);
};

// details: { title, description, subject, tags }. file: the chosen File, or null.
// The file goes to Cloud Storage first (that is what the progress bar shows),
// then the details and the file's path are sent to the API.
const sendReviewer = async (method, path, details, file, onProgress) => {
  const body = Object.assign({}, details);
  if (file) {
    body.file = await uploadToInbox(file, onProgress);
  } else {
    onProgress(100);
  }
  return apiRequest(path, { method: method, json: body });
};

export const createReviewer = (details, file, onProgress) => {
  return sendReviewer('POST', '/api/reviewers', details, file, onProgress);
};

// Leave file as null to keep the current file.
export const updateReviewer = (reviewerId, details, file, onProgress) => {
  return sendReviewer('PUT', `/api/reviewers/${reviewerId}`, details, file, onProgress);
};

export const deleteReviewer = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}`, { method: 'DELETE' });
};

export const addUpvote = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}/upvote`, { method: 'PUT' });
};

export const removeUpvote = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}/upvote`, { method: 'DELETE' });
};

// Adds this reviewer to the user's "Saved" list. Answers { isSaved, savedId }.
export const saveReviewer = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}/save`, { method: 'PUT' });
};

// Removes it again, together with the notes and flashcards made for it.
export const unsaveReviewer = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}/save`, { method: 'DELETE' });
};

// Adds this reviewer to the user's "Recently viewed" list.
export const recordView = (reviewerId) => {
  return apiRequest(`/api/reviewers/${reviewerId}/view`, { method: 'POST' });
};
