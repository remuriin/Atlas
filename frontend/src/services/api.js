// A small wrapper around fetch for talking to the LearnHub API.
// It adds the login token, reads the JSON reply, and turns API errors
// into Error objects with a message that is safe to show to people.
import { auth } from '../firebase';

let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
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

// Sends a form that contains a file. fetch cannot report upload progress,
// so this one uses XMLHttpRequest, which can.
// onProgress is called with a whole number from 0 to 100.
export const uploadWithProgress = async (method, path, formData, onProgress) => {
  const token = await getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}${path}`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (err) {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(buildApiError(xhr.status, data));
      }
    };

    xhr.onerror = () => {
      reject(buildApiError(0, { error: { message: NETWORK_MESSAGE } }));
    };

    xhr.send(formData);
  });
};
