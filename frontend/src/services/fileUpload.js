// Puts a chosen file in the logged-in user's own inbox folder in Cloud Storage
// ("pending/<uid>/"). The form then tells the API the file's path, and the API
// checks the file and moves it to its permanent place.
import { ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from '../firebase';
import { findContentType, getExtension } from './fileRules';

// Storage's own error code when its rules refuse the file (wrong type or too big).
const REFUSED = 'storage/unauthorized';

// A random file name, so two uploads can never overwrite each other.
const makeRandomName = (fileName) => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let name = '';
  bytes.forEach((byte) => {
    name += byte.toString(16).padStart(2, '0');
  });
  return `${name}.${getExtension(fileName)}`;
};

// Resolves with { path, name } for the API.
// onProgress is called with a whole number from 0 to 100.
export const uploadToInbox = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!auth.currentUser) {
      reject(new Error('Please log in to do that.'));
      return;
    }

    const path = `pending/${auth.currentUser.uid}/${makeRandomName(file.name)}`;
    // The content type comes from the file's extension, so it is the same on every
    // computer (some browsers leave it empty for Word and PowerPoint files).
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: findContentType(file.name),
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (err) => {
        let message = 'The file could not be uploaded. Check your internet connection and try again.';
        if (err.code === REFUSED) {
          message = 'That file was not accepted. Check that it is an allowed type and not too large.';
        }
        const uploadError = new Error(message);
        uploadError.fields = { file: message };
        reject(uploadError);
      },
      () => {
        resolve({ path: path, name: file.name });
      }
    );
  });
};
