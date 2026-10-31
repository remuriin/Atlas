// The page for editing a study reviewer you uploaded.
// It loads the saved details first, then shows the same form as the upload page.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getReviewer } from '../services/reviewersService';
import Alert from '../components/Alert';
import PageHeading from '../components/PageHeading';
import ReviewerForm from '../components/ReviewerForm';
import Spinner from '../components/Spinner';

function EditReviewerPage() {
  const params = useParams();
  const [reviewer, setReviewer] = useState(null);
  // status is 'loading', 'ready', 'missing', 'not-owner', or 'error'.
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // ProtectedRoute only shows this page once the login is known,
  // so the request below always carries the user's token.
  useEffect(() => {
    let isCancelled = false;

    const loadReviewer = async () => {
      setStatus('loading');
      try {
        const data = await getReviewer(params.id);
        if (isCancelled) {
          return;
        }
        setReviewer(data);
        // The server also refuses edits from anyone else. Checking here simply
        // avoids showing a form that could never be saved.
        if (data.isOwner) {
          setStatus('ready');
        } else {
          setStatus('not-owner');
        }
      } catch (err) {
        if (isCancelled) {
          return;
        }
        if (err.status === 404 || err.status === 400) {
          setStatus('missing');
        } else {
          setErrorMessage(err.message);
          setStatus('error');
        }
      }
    };

    loadReviewer();

    return () => {
      isCancelled = true;
    };
  }, [params.id, retryCount]);

  return (
    <div className="edit-form">
      <PageHeading title="Edit study reviewer" />

      {status === 'loading' && <Spinner label="Loading study reviewer…" />}

      {status === 'missing' && (
        <div className="stack">
          <Alert type="error">
            This study reviewer could not be found. It may have been deleted.
          </Alert>
          <div>
            <Link className="button" to="/profile">
              Go to your profile
            </Link>
          </div>
        </div>
      )}

      {status === 'not-owner' && (
        <div className="stack">
          <Alert type="error">You can only edit study reviewers that you uploaded.</Alert>
          <div>
            <Link className="button" to={`/reviewers/${params.id}`}>
              Back to the study reviewer
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="stack">
          <Alert type="error">{errorMessage}</Alert>
          <div>
            <button type="button" className="button" onClick={() => setRetryCount(retryCount + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && <ReviewerForm mode="edit" reviewer={reviewer} />}
    </div>
  );
}

export default EditReviewerPage;
