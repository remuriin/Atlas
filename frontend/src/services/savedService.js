// API calls about the logged-in user's saved study reviewers, notes, and flashcards.
import { apiRequest } from './api';

export const listMySaved = () => {
  return apiRequest('/api/me/saved');
};

// One saved item, including its notes.
export const getSavedItem = (savedId) => {
  return apiRequest(`/api/saved/${savedId}`);
};

// Removes the saved item together with its notes and flashcards.
export const deleteSavedItem = (savedId) => {
  return apiRequest(`/api/saved/${savedId}`, { method: 'DELETE' });
};

export const saveNotes = (savedId, notes) => {
  return apiRequest(`/api/saved/${savedId}/notes`, { method: 'PUT', json: { notes: notes } });
};

export const listFlashcards = (savedId) => {
  return apiRequest(`/api/saved/${savedId}/flashcards`);
};

// Asks the server to write a new set of flashcards (replacing any old set).
// This can take up to about a minute.
export const createFlashcards = (savedId, count) => {
  return apiRequest(`/api/saved/${savedId}/flashcards`, {
    method: 'POST',
    json: { count: count },
  });
};

export const deleteFlashcards = (savedId) => {
  return apiRequest(`/api/saved/${savedId}/flashcards`, { method: 'DELETE' });
};

// status is 'new', 'learning', or 'learned'.
export const setFlashcardStatus = (savedId, cardId, status) => {
  return apiRequest(`/api/saved/${savedId}/flashcards/${cardId}`, {
    method: 'PUT',
    json: { status: status },
  });
};
