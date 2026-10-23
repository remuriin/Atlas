// API calls about study reviewers.
import { API_URL, apiRequest, uploadWithProgress } from './api';

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

export const createReviewer = (formData, onProgress) => {
  return uploadWithProgress('POST', '/api/reviewers', formData, onProgress);
};

export const updateReviewer = (reviewerId, formData, onProgress) => {
  return uploadWithProgress('PUT', `/api/reviewers/${reviewerId}`, formData, onProgress);
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
