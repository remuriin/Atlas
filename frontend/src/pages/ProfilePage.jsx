// Your own page: account details, recently viewed, and your uploads.
import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  getMyProfile,
  listMyRecentlyViewed,
  listMyReviewers,
  updateMyProfile,
} from '../services/profileService';
import { deleteReviewer } from '../services/reviewersService';
import { deleteAccount, logout } from '../services/authService';
import { countLabel, formatDate } from '../services/format';
import { clearFeed } from '../services/feedMemory';
import Alert from '../components/Alert';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FlashMessage from '../components/FlashMessage';
import Avatar from '../components/Avatar';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import ReviewerList from '../components/ReviewerList';
import Spinner from '../components/Spinner';

const NAME_MIN = 2;
const NAME_MAX = 50;

function ProfilePage() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  // Display name form.
  let startName = '';
  if (auth.profile) {
    startName = auth.profile.displayName;
  }
  const [displayName, setDisplayName] = useState(startName);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [profileError, setProfileError] = useState('');

  // The two lists. Each has its own status: 'loading', 'ready', or 'error'.
  const [uploads, setUploads] = useState([]);
  const [uploadsStatus, setUploadsStatus] = useState('loading');
  const [uploadsError, setUploadsError] = useState('');
  const [recent, setRecent] = useState([]);
  const [recentStatus, setRecentStatus] = useState('loading');
  const [recentError, setRecentError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Delete confirmation.
  const [reviewerToDelete, setReviewerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deletedCount, setDeletedCount] = useState(0);

  // Deleting the whole account.
  const [isAccountDeleteOpen, setIsAccountDeleteOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState('');
  // True when the server asked for a fresh login first.
  const [needsFreshLogin, setNeedsFreshLogin] = useState(false);

  // If the profile could not be loaded when the app started, try once more here.
  useEffect(() => {
    if (auth.profile) {
      return;
    }
    const loadProfile = async () => {
      try {
        const profile = await getMyProfile();
        auth.setProfile(profile);
        setDisplayName(profile.displayName);
        setProfileError('');
      } catch (err) {
        setProfileError(err.message);
      }
    };
    loadProfile();
  }, [retryCount]);

  // Load "My uploads".
  useEffect(() => {
    let isCancelled = false;

    const loadUploads = async () => {
      setUploadsStatus('loading');
      try {
        const data = await listMyReviewers();
        if (!isCancelled) {
          setUploads(data.items);
          setUploadsStatus('ready');
        }
      } catch (err) {
        if (!isCancelled) {
          setUploadsError(err.message);
          setUploadsStatus('error');
        }
      }
    };

    loadUploads();

    return () => {
      isCancelled = true;
    };
  }, [retryCount]);

  // Load "Recently viewed".
  useEffect(() => {
    let isCancelled = false;

    const loadRecent = async () => {
      setRecentStatus('loading');
      try {
        const data = await listMyRecentlyViewed();
        if (!isCancelled) {
          setRecent(data.items);
          setRecentStatus('ready');
        }
      } catch (err) {
        if (!isCancelled) {
          setRecentError(err.message);
          setRecentStatus('error');
        }
      }
    };

    loadRecent();

    return () => {
      isCancelled = true;
    };
  }, [retryCount]);

  // After a delete, the Delete button that opened the dialog no longer exists.
  // Send focus to the section heading instead of letting it get lost. This is an
  // effect so that it runs after the dialog has closed and released focus.
  useEffect(() => {
    if (deletedCount === 0) {
      return;
    }
    const heading = document.getElementById('uploads-heading');
    if (heading) {
      heading.focus();
    }
  }, [deletedCount]);

  const handleNameSubmit = async (event) => {
    event.preventDefault();
    if (isSavingName) {
      return;
    }
    setNameSuccess('');

    const cleanName = displayName.trim();
    if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
      setNameError(`Enter a display name between ${NAME_MIN} and ${NAME_MAX} characters.`);
      document.getElementById('profile-displayName').focus();
      return;
    }
    setNameError('');

    setIsSavingName(true);
    try {
      const profile = await updateMyProfile(cleanName);
      // Updating the shared profile also updates the name shown in the header.
      auth.setProfile(profile);
      setDisplayName(profile.displayName);
      setNameSuccess('Your display name was saved.');
      // Cards in "My uploads" show the author name, so refresh that text too.
      setUploads(
        uploads.map((reviewer) => Object.assign({}, reviewer, { authorName: profile.displayName }))
      );
    } catch (err) {
      setNameError(err.message);
      document.getElementById('profile-displayName').focus();
    }
    setIsSavingName(false);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteReviewer(reviewerToDelete.id);
      // The remembered feed may still list the deleted reviewer.
      clearFeed();
      // Take it out of both lists without reloading the page.
      setUploads(uploads.filter((reviewer) => reviewer.id !== reviewerToDelete.id));
      setRecent(recent.filter((reviewer) => reviewer.id !== reviewerToDelete.id));
      setDeleteMessage(`“${reviewerToDelete.title}” was deleted.`);
      setReviewerToDelete(null);
      setDeletedCount(deletedCount + 1);
    } catch (err) {
      setDeleteError(err.message);
    }
    setIsDeleting(false);
  };

  const handleDismissDeleteMessage = () => {
    setDeleteMessage('');
    // The close button disappears, so move focus to the section heading.
    const heading = document.getElementById('uploads-heading');
    if (heading) {
      heading.focus();
    }
  };

  const handleDeleteCancel = () => {
    setReviewerToDelete(null);
    setDeleteError('');
  };

  let email = '';
  let memberSince = '';
  if (auth.profile) {
    email = auth.profile.email;
    memberSince = formatDate(auth.profile.createdAt);
  }

  // Google accounts bring their picture with them; email accounts show initials.
  let photoUrl = null;
  let signInText = 'Signed in with email. Accounts signed in with Google show their Google picture.';
  if (auth.firebaseUser) {
    photoUrl = auth.firebaseUser.photoURL;
    const usesGoogle = auth.firebaseUser.providerData.some(
      (provider) => provider.providerId === 'google.com'
    );
    if (usesGoogle) {
      signInText = 'Signed in with Google. Your picture comes from your Google account.';
    }
  }

  const handleAccountDelete = async () => {
    setIsDeletingAccount(true);
    setAccountDeleteError('');
    try {
      await deleteAccount();
      clearFeed();
      navigate('/', { state: { flash: 'Your account and everything in it were deleted.' } });
    } catch (err) {
      setIsDeletingAccount(false);
      if (err.status === 401) {
        // The login is too old: close the dialog and offer a fresh one.
        setIsAccountDeleteOpen(false);
        setNeedsFreshLogin(true);
      } else {
        setAccountDeleteError(err.message);
      }
    }
  };

  // Logs out and comes back here after logging in, so deleting can be done right away.
  const handleFreshLogin = async () => {
    await logout();
    navigate('/login', {
      state: { from: '/profile', message: 'Log in again to delete your account.' },
    });
  };

  let dialogMessage = '';
  if (reviewerToDelete) {
    dialogMessage = `“${reviewerToDelete.title}” and its file will be removed for everyone. This cannot be undone.`;
  }

  let saveNameText = 'Save display name';
  if (isSavingName) {
    saveNameText = 'Saving…';
  }

  return (
    <div className="stack stack--loose">
      <div>
        <PageHeading title="Your profile" />
        <p className="text-muted">Manage your account and the study reviewers you have shared.</p>
      </div>

      <FlashMessage />

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="section-heading">
          Account
        </h2>

        {profileError !== '' && (
          <div className="stack">
            <Alert type="error">{profileError}</Alert>
            <div>
              <button type="button" className="button" onClick={() => setRetryCount(retryCount + 1)}>
                Try again
              </button>
            </div>
          </div>
        )}

        {profileError === '' && !auth.profile && <Spinner label="Loading your account…" />}

        {auth.profile && (
          <div className="card card--padded card--narrow">
            <div className="profile-identity">
              <Avatar photoUrl={photoUrl} name={auth.profile.displayName} size="large" />
              <div>
                <p className="profile-identity__name">{auth.profile.displayName}</p>
                <p className="text-muted text-small">{signInText}</p>
              </div>
            </div>
            <dl className="profile-details">
              <dt>Email (only you can see this)</dt>
              <dd>{email}</dd>
              <dt>Member since</dt>
              <dd>{memberSince}</dd>
            </dl>

            <form className="form" onSubmit={handleNameSubmit} noValidate>
              <FormField
                id="profile-displayName"
                label="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                maxLength={NAME_MAX}
                autoComplete="nickname"
                hint="Shown next to the study reviewers you share."
                error={nameError}
              />
              <div className="form__actions">
                <button type="submit" className="button" aria-disabled={isSavingName}>
                  {saveNameText}
                </button>
              </div>
              {/* Always on the page, so screen readers announce the text when it appears. */}
              <div role="status">
                {nameSuccess !== '' && (
                  <p className="field__success">
                    <Icon name="check" />
                    <span>{nameSuccess}</span>
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="section-heading">
          Recently viewed
        </h2>

        {recentStatus === 'loading' && <Spinner label="Loading recently viewed…" />}
        {recentStatus === 'error' && <Alert type="error">{recentError}</Alert>}

        {recentStatus === 'ready' && recent.length === 0 && (
          <EmptyState
            icon="clock"
            title="Nothing viewed yet"
            message="Study reviewers you open will be listed here, so they are easy to find again."
          >
            <Link className="button" to="/">
              Browse study reviewers
            </Link>
          </EmptyState>
        )}

        {recentStatus === 'ready' && recent.length > 0 && (
          <ul className="card compact-list">
            {recent.map((reviewer) => (
              <li key={reviewer.id}>
                <Link to={`/reviewers/${reviewer.id}`} state={{ fromPath: '/profile' }}>
                  {reviewer.title}
                </Link>
                <span className="meta">
                  {reviewer.subject}, by {reviewer.authorName},{' '}
                  {countLabel(reviewer.upvoteCount, 'upvote', 'upvotes')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="uploads-heading">
        <h2 id="uploads-heading" className="section-heading" tabIndex="-1">
          My uploads
        </h2>

        <div className="stack">
          <div role="status">
            {deleteMessage !== '' && (
              <Alert type="success" onDismiss={handleDismissDeleteMessage}>
                {deleteMessage}
              </Alert>
            )}
          </div>

          {uploadsStatus === 'loading' && <Spinner label="Loading your uploads…" />}

          {uploadsStatus === 'error' && (
            <div className="stack">
              <Alert type="error">{uploadsError}</Alert>
              <div>
                <button
                  type="button"
                  className="button"
                  onClick={() => setRetryCount(retryCount + 1)}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {uploadsStatus === 'ready' && uploads.length === 0 && (
            <EmptyState
              icon="upload"
              title="You have not shared anything yet"
              message="Have notes or a study guide you made? Share it so other learners can use it."
            >
              <Link className="button button--primary" to="/upload">
                <Icon name="upload" />
                Share a study reviewer
              </Link>
            </EmptyState>
          )}

          {uploadsStatus === 'ready' && uploads.length > 0 && (
            <ReviewerList
              items={uploads}
              headingLevel="h3"
              showOwnerActions
              onDelete={(reviewer) => setReviewerToDelete(reviewer)}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="delete-account-heading">
        <h2 id="delete-account-heading" className="section-heading">
          Delete account
        </h2>
        <div className="card card--padded card--narrow stack">
          <p>
            This deletes your profile, every study reviewer you shared (and its file), your upvotes,
            saved list, notes, flashcards, and reports, and your login. It cannot be undone.
            Other people keep their own notes on reviewers they saved from you.
          </p>
          {needsFreshLogin && (
            <div className="stack">
              <Alert type="info">
                For your safety, log in again, then delete your account within 5 minutes.
              </Alert>
              <div>
                <button type="button" className="button button--primary" onClick={handleFreshLogin}>
                  Log in again
                </button>
              </div>
            </div>
          )}
          <div>
            <button
              type="button"
              className="button button--danger-outline"
              onClick={() => setIsAccountDeleteOpen(true)}
            >
              <Icon name="trash" />
              Delete my account
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        id="delete-account-dialog"
        isOpen={isAccountDeleteOpen}
        title="Delete your account?"
        message="Everything listed above is removed for good. This cannot be undone."
        confirmLabel="Delete my account"
        isBusy={isDeletingAccount}
        error={accountDeleteError}
        onConfirm={handleAccountDelete}
        onCancel={() => {
          setIsAccountDeleteOpen(false);
          setAccountDeleteError('');
        }}
      />

      <ConfirmDialog
        id="delete-upload-dialog"
        isOpen={reviewerToDelete !== null}
        title="Delete this study reviewer?"
        message={dialogMessage}
        confirmLabel="Delete"
        isBusy={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

export default ProfilePage;
