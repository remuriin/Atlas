// The page for one study reviewer: its details, the file, and the upvote button.
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  deleteReviewer,
  getFileUrl,
  getReviewer,
  recordView,
} from '../services/reviewersService';
import {
  describeFileType,
  formatDate,
  formatFileSize,
  opensInBrowser,
} from '../services/format';
import { describeCategory } from '../services/categories';
import { clearFeed } from '../services/feedMemory';
import Alert from '../components/Alert';
import ConfirmDialog from '../components/ConfirmDialog';
import FlashMessage from '../components/FlashMessage';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import SaveButton from '../components/SaveButton';
import Spinner from '../components/Spinner';
import StrandLink from '../components/StrandLink';
import TagList from '../components/TagList';
import UpvoteButton from '../components/UpvoteButton';

function ReviewerPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useContext(AuthContext);

  const [reviewer, setReviewer] = useState(null);
  // status is 'loading', 'ready', 'missing', or 'error'.
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  let userId = '';
  if (auth.firebaseUser) {
    userId = auth.firebaseUser.uid;
  }

  // Load the reviewer. Runs again after logging in or out, because
  // "have I upvoted this?" and "is this mine?" depend on who is asking.
  useEffect(() => {
    if (auth.isLoading) {
      return undefined;
    }
    let isCancelled = false;

    const loadReviewer = async () => {
      setStatus('loading');
      try {
        const data = await getReviewer(params.id);
        if (isCancelled) {
          return;
        }
        setReviewer(data);
        setStatus('ready');
      } catch (err) {
        if (isCancelled) {
          return;
        }
        // 404 = no such reviewer, 400 = the address has a broken id.
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
  }, [params.id, userId, auth.isLoading, retryCount]);

  // Add this reviewer to the user's "Recently viewed" list.
  // This is a separate request so that simply loading the page never changes data.
  useEffect(() => {
    if (status !== 'ready' || userId === '') {
      return;
    }
    const saveView = async () => {
      try {
        await recordView(params.id);
      } catch (err) {
        // Not worth interrupting anyone over: the page itself works fine.
      }
    };
    saveView();
  }, [status, userId, params.id]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteReviewer(reviewer.id);
      // The remembered feed may still list the deleted reviewer.
      clearFeed();
      navigate('/profile', { state: { flash: `“${reviewer.title}” was deleted.` } });
    } catch (err) {
      setDeleteError(err.message);
      setIsDeleting(false);
    }
  };

  // Saving makes the "Study" link appear; unsaving hides it again.
  const handleSaveChange = (result) => {
    setReviewer(Object.assign({}, reviewer, { isSaved: result.isSaved, savedId: result.savedId }));
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
    setDeleteError('');
  };

  // Where the Back link leads. A card that was opened from a list says which
  // list it was, and then Back really goes back: the list is exactly as it was
  // left (same tab, filters, and scroll position).
  let cameFromPath = '';
  if (location.state && location.state.fromPath) {
    cameFromPath = location.state.fromPath;
  }
  let backText = 'Back to study reviewers';
  if (cameFromPath === '/profile') {
    backText = 'Back to your profile';
  }

  const handleBackClick = (event) => {
    if (cameFromPath !== '') {
      // Step back in the browser history instead of opening a fresh copy of the list.
      event.preventDefault();
      navigate(-1);
    }
    // Opened directly (a shared link or a bookmark): the link simply goes to the feed.
  };

  // The heading is always on the page, so the tab title and focus are right
  // even while the content is still loading.
  let headingText = 'Loading study reviewer…';
  if (status === 'ready') {
    headingText = reviewer.title;
  } else if (status === 'missing') {
    headingText = 'Study reviewer not found';
  } else if (status === 'error') {
    headingText = 'Study reviewer';
  }

  let fileActionText = 'Download file';
  let fileActionIcon = 'download';
  if (status === 'ready' && opensInBrowser(reviewer.fileMime)) {
    fileActionText = 'Open file';
    fileActionIcon = 'external';
  }

  return (
    <div className="page-narrow stack">
      <div>
        <Link className="back-link" to="/" onClick={handleBackClick}>
          <Icon name="arrow-left" />
          {backText}
        </Link>
        <PageHeading title={headingText} />
      </div>

      {status === 'loading' && <Spinner label="Loading study reviewer…" />}

      {status === 'missing' && (
        <div className="stack">
          <p>This study reviewer may have been deleted, or the link may be wrong.</p>
          <div>
            <Link className="button" to="/">
              Browse study reviewers
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

      {status === 'ready' && (
        <article className="stack">
          <FlashMessage />

          <div className="detail-header">
            <p>
              <StrandLink strand={reviewer.strand} />
            </p>
            <p className="reviewer-card__category">{describeCategory(reviewer)}</p>
            <p className="meta">
              <span className="meta__item">
                <Icon name="user" />
                Shared by {reviewer.authorName}
              </span>
              <span className="meta__item">
                <Icon name="clock" />
                Posted {formatDate(reviewer.createdAt)}
              </span>
            </p>
            <div className="detail-actions">
              <UpvoteButton
                reviewerId={reviewer.id}
                title={reviewer.title}
                count={reviewer.upvoteCount}
                hasUpvoted={reviewer.hasUpvoted}
              />
              <SaveButton
                reviewerId={reviewer.id}
                title={reviewer.title}
                isSaved={reviewer.isSaved}
                onChange={handleSaveChange}
              />
              {reviewer.isSaved && (
                <Link className="button" to={`/saved/${reviewer.savedId}`}>
                  <Icon name="cards" />
                  Study with notes and flashcards
                </Link>
              )}
              {reviewer.isOwner && (
                <Link className="button" to={`/reviewers/${reviewer.id}/edit`}>
                  <Icon name="pencil" />
                  Edit
                </Link>
              )}
              {reviewer.isOwner && (
                <button
                  type="button"
                  className="button button--danger-outline"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Icon name="trash" />
                  Delete
                </button>
              )}
            </div>
          </div>

          <section className="stack" aria-labelledby="about-heading">
            <h2 id="about-heading">About this study reviewer</h2>
            <p className="detail-description">{reviewer.description}</p>
            <TagList tags={reviewer.tags} />
          </section>

          <section className="stack" aria-labelledby="file-heading">
            <h2 id="file-heading">File</h2>
            <div className="card file-box">
              <div>
                <p className="file-box__name">{reviewer.fileName}</p>
                <p className="meta">
                  {describeFileType(reviewer.fileName)}, {formatFileSize(reviewer.fileSize)}
                </p>
              </div>
              <a
                className="button button--primary"
                href={getFileUrl(reviewer.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name={fileActionIcon} />
                {fileActionText}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </div>
          </section>

          <ConfirmDialog
            id="delete-reviewer-dialog"
            isOpen={isDeleteOpen}
            title="Delete this study reviewer?"
            message={`“${reviewer.title}” and its file will be removed for everyone. This cannot be undone.`}
            confirmLabel="Delete"
            isBusy={isDeleting}
            error={deleteError}
            onConfirm={handleDelete}
            onCancel={handleCloseDelete}
          />
        </article>
      )}
    </div>
  );
}

export default ReviewerPage;
