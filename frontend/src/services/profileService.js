// API calls about the logged-in user's own profile and lists.
import { apiRequest } from './api';

// The API creates the profile the first time this is called for a new account.
export const getMyProfile = () => {
  return apiRequest('/api/me');
};

export const updateMyProfile = (displayName) => {
  return apiRequest('/api/me', { method: 'PUT', json: { displayName: displayName } });
};

export const deleteMyAccount = () => {
  return apiRequest('/api/me', { method: 'DELETE' });
};

export const listMyReviewers = () => {
  return apiRequest('/api/me/reviewers');
};

export const listMyRecentlyViewed = () => {
  return apiRequest('/api/me/recently-viewed');
};
