// Shows a saved study reviewer's file inside the page.
//   PDF:   in a frame, using the browser's own PDF viewer
//   image: as a picture
//   text:  as plain text
//   Word and PowerPoint cannot be shown by a browser, so those offer a download.
// The file is fetched once and shown from a temporary in-memory address
// (an "object URL"), which is thrown away again when the page closes.
//
// props: item   the saved item from the API (item.reviewer is null when removed)
import { useEffect, useState } from 'react';
import { apiRequestBlob } from '../services/api';
import { getFileUrl } from '../services/reviewersService';
import { describeFileType, formatFileSize } from '../services/format';
import Alert from './Alert';
import Icon from './Icon';
import Spinner from './Spinner';

const findViewKind = (fileMime) => {
  if (fileMime === 'application/pdf') {
    return 'pdf';
  }
  if (fileMime === 'image/png' || fileMime === 'image/jpeg') {
    return 'image';
  }
  if (fileMime === 'text/plain') {
    return 'text';
  }
  return 'download-only';
};

function FileViewer(props) {
  const reviewer = props.item.reviewer;

  let viewKind = 'removed';
  if (reviewer) {
    viewKind = findViewKind(reviewer.fileMime);
  }

  // status is 'loading', 'ready', or 'error'.
  const [status, setStatus] = useState('loading');
  const [objectUrl, setObjectUrl] = useState('');
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  let reviewerId = null;
  if (reviewer) {
    reviewerId = reviewer.id;
  }

  useEffect(() => {
    if (viewKind === 'removed' || viewKind === 'download-only') {
      return undefined;
    }

    let isCancelled = false;
    let createdUrl = '';

    const loadFile = async () => {
      setStatus('loading');
      try {
        const blob = await apiRequestBlob(`/api/reviewers/${reviewerId}/file`);
        if (isCancelled) {
          return;
        }
        if (viewKind === 'text') {
          setText(await blob.text());
        } else {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        }
        setStatus('ready');
      } catch (err) {
        if (isCancelled) {
          return;
        }
        setErrorMessage(err.message);
        setStatus('error');
      }
    };

    loadFile();

    return () => {
      isCancelled = true;
      // Frees the memory the file was taking up.
      if (createdUrl !== '') {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [reviewerId, viewKind, retryCount]);

  if (viewKind === 'removed') {
    return (
      <section className="study-section" aria-labelledby="material-heading">
        <h2 id="material-heading" className="section-heading">
          Material
        </h2>
        <div className="card card--padded file-unavailable">
          <Icon name="file" large />
          <p>The original file was removed by its uploader.</p>
        </div>
      </section>
    );
  }

  const fileType = describeFileType(reviewer.fileName);

  return (
    <section className="study-section" aria-labelledby="material-heading">
      <h2 id="material-heading" className="section-heading">
        Material
      </h2>

      <div className="viewer-toolbar">
        <p className="meta">
          <span className="meta__item">
            <Icon name="file" />
            {reviewer.fileName}
          </span>
          <span>
            {fileType}, {formatFileSize(reviewer.fileSize)}
          </span>
        </p>
        <div className="row">
          {/* Saves the file to the device, so it can be read without internet. */}
          <a className="button button--primary" href={getFileUrl(reviewer.id, true)}>
            <Icon name="download" />
            Download file
          </a>
          {viewKind !== 'download-only' && (
            <a
              className="button"
              href={getFileUrl(reviewer.id, false)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" />
              Open in new tab
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>

      {viewKind === 'download-only' && (
        <div className="card card--padded file-unavailable">
          <Icon name="file" large />
          <p>
            {fileType} files cannot be shown inside the browser. Download it to read it, then
            take your notes here.
          </p>
        </div>
      )}

      {viewKind !== 'download-only' && status === 'loading' && <Spinner label="Loading the file…" />}

      {viewKind !== 'download-only' && status === 'error' && (
        <div className="stack">
          <Alert type="error">{errorMessage}</Alert>
          <div>
            <button type="button" className="button" onClick={() => setRetryCount(retryCount + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Some phone browsers show only a link or the first page of a PDF here.
          "Open in new tab" above always shows the whole file. */}
      {viewKind === 'pdf' && status === 'ready' && (
        <iframe className="file-frame" src={objectUrl} title={`${props.item.title} (PDF)`} />
      )}

      {viewKind === 'image' && status === 'ready' && (
        <div className="file-image-wrap">
          <img className="file-image" src={objectUrl} alt={`${props.item.title} (image file)`} />
        </div>
      )}

      {/* The text flows with the page (no box of its own to scroll), so it can be
          read with the keyboard, zoomed, and selected like any other text. */}
      {viewKind === 'text' && status === 'ready' && <pre className="file-text">{text}</pre>}
    </section>
  );
}

export default FileViewer;
