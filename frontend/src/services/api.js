// A small wrapper around fetch for talking to the LearnHub API.
// It adds the login token, reads the JSON reply, and turns API errors
// into Error objects with a message that is safe to show to people.
import { auth } from '../firebase';

// Without a setting, use the "api" function in the local emulators.
let apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/demo-learnhub/us-central1/api';
// Remove a trailing slash so "http://host/" + "/api" does not become "//api".
if (apiUrl.endsWith('/')) {
  apiUrl = apiUrl.slice(0, -1);
}

export const API_URL = apiUrl;

const NETWORK_MESSAGE = 'Could not reach LearnHub. Check your internet connection and try again.';
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

// Firebase renews the token by itself when it is close to expiring.
const getToken = async () => {
  if (!auth.currentUser) {
    return null;
  }
  const token = await auth.currentUser.getIdToken();
  return token;
};

// Builds an Error from the API's error format: { error: { message, fields } }
const buildApiError = (status, data) => {
  let message = FALLBACK_MESSAGE;
  let fields = null;

  if (data && data.error) {
    if (data.error.message) {
      message = data.error.message;
    }
    if (data.error.fields) {
      fields = data.error.fields;
    }
  }

  const err = new Error(message);
  err.status = status;
  // "fields" lets a form show each problem next to the matching input.
  err.fields = fields;
  return err;
};

// options: { method: 'PUT', json: { some: 'data' } }  (both optional)
export const apiRequest = async (path, options) => {
  const settings = options || {};
  const headers = {};
  const fetchOptions = { method: settings.method || 'GET', headers: headers };

  const token = await getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (settings.json) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(settings.json);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, fetchOptions);
  } catch (err) {
    // fetch only throws when the request never got an answer (offline, server down).
    throw buildApiError(0, { error: { message: NETWORK_MESSAGE } });
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    throw buildApiError(response.status, data);
  }
  return data;
};

// Fetches a file (for example a PDF) from any full address and returns it as a Blob,
// so the page can show it with URL.createObjectURL. Errors are turned into the usual
// Error objects.
export const fetchBlob = async (url) => {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw buildApiError(0, { error: { message: NETWORK_MESSAGE } });
  }

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }
    throw buildApiError(response.status, data);
  }
  return response.blob();
};

// The same, for a file sent by the LearnHub API itself.
export const apiRequestBlob = (path) => {
  return fetchBlob(`${API_URL}${path}`);
};
