// Your saved study reviewers. Each one opens a study page with the file,
// your notes, and your flashcards.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteSavedItem, listMySaved } from '../services/savedService';
import { clearFeed } from '../services/feedMemory';
import { countLabel, describeFileType, formatDate } from '../services/format';
import { describeCategory, strandSlug } from '../services/categories';
import Alert from '../components/Alert';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FlashMessage from '../components/FlashMessage';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';
import StrandLink from '../components/StrandLink';

const describeNotes = (item) => {
  if (item.hasNotes) {
    return 'Has notes';
  }
  return 'No notes yet';
};

function SavedPage() {
  const [items, setItems] = useState([]);
  // status is 'loading', 'ready', or 'error'.
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const [itemToRemove, setItemToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeMessage, setRemoveMessage] = useState('');
  const [removedCount, setRemovedCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const loadSaved = async () => {
      setStatus('loading');
      try {
        const data = await listMySaved();
        if (!isCancelled) {
          setItems(data.items);
          setStatus('ready');
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(err.message);
          setStatus('error');
        }
      }
    };

    loadSaved();

    return () => {
      isCancelled = true;
    };
  }, [retryCount]);

  // The Remove button that opened the dialog is gone after a removal, so move
  // focus to the page heading (after the dialog has closed and let go of focus).
  useEffect(() => {
    if (removedCount === 0) {
      return;
    }
    const heading = document.getElementById('page-heading');
    if (heading) {
      heading.focus();
    }
  }, [removedCount]);

  const handleRemoveConfirm = async () => {
    setIsRemoving(true);
    setRemoveError('');
    try {
      await deleteSavedItem(itemToRemove.id);
      // The remembered feed would still show this one as "Saved".
      clearFeed();
      setItems(items.filter((item) => item.id !== itemToRemove.id));
      setRemoveMessage(`“${itemToRemove.title}” was removed from Saved.`);
      setItemToRemove(null);
      setRemovedCount(removedCount + 1);
    } catch (err) {
      setRemoveError(err.message);
    }
    setIsRemoving(false);
  };

  const handleRemoveCancel = () => {
    setItemToRemove(null);
    setRemoveError('');
  };

  let dialogMessage = '';
  if (itemToRemove) {
    dialogMessage = `Your notes and flashcards for “${itemToRemove.title}” will be deleted too. This cannot be undone.`;
  }

  return (
    <div className="stack">
      <div>
        <PageHeading title="Saved study reviewers" />
        <p className="page-intro">
          Only you can see this list. Open one to read it, take notes, and practise with
          flashcards.
        </p>
        <FlashMessage />
        {/* Always on the page (so the message is announced), but outside the
            spaced-out stack so it takes no room while empty. */}
        <div role="status">
          {removeMessage !== '' && <Alert type="success">{removeMessage}</Alert>}
        </div>
      </div>

      {status === 'loading' && <Spinner label="Loading your saved study reviewers…" />}

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

      {status === 'ready' && items.length === 0 && (
        <EmptyState
          icon="bookmark"
          title="Nothing saved yet"
          message="Press Save on any study reviewer to keep it here, with room for your own notes and flashcards."
        >
          <Link className="button button-primary" to="/browse">
            Browse study reviewers
          </Link>
        </EmptyState>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="reviewer-grid">
          {items.map((item) => (
            <li key={item.id}>
              <article className={`card reviewer-card strand-${strandSlug(item.strand)}`}>
                <div className="reviewer-card-body">
                  <p>
                    <StrandLink strand={item.strand} />
                  </p>

                  <h2 className="reviewer-card-title">
                    <Link id={`saved-link-${item.id}`} to={`/saved/${item.id}`}>
                      {item.title}
                    </Link>
                  </h2>

                  {/* Grade, quarter, and type are only known while the original exists. */}
                  <p className="reviewer-card-category">
                    {describeCategory(Object.assign({ subject: item.subject }, item.reviewer))}
                  </p>

                  {item.isRemoved && (
                    <p className="status-note">
                      <Icon name="alert" />
                      The original was removed by its uploader. Your notes and flashcards are
                      still here.
                    </p>
                  )}

                  {!item.isRemoved && (
                    <p className="meta">
                      <span className="meta-item">
                        <Icon name="user" />
                        <span className="visually-hidden">Shared by</span>
                        {item.reviewer.authorName}
                      </span>
                      <span className="meta-item">
                        <Icon name="file" />
                        <span className="visually-hidden">File:</span>
                        {describeFileType(item.reviewer.fileName)}
                      </span>
                    </p>
                  )}

                  <p className="meta">
                    <span className="meta-item">
                      <Icon name="pencil" />
                      {describeNotes(item)}
                    </span>
                    <span className="meta-item">
                      <Icon name="cards" />
                      {countLabel(item.flashcardCount, 'flashcard', 'flashcards')}
                    </span>
                    <span className="meta-item">
                      <Icon name="clock" />
                      Saved {formatDate(item.savedAt)}
                    </span>
                  </p>
                </div>

                <div className="reviewer-card-footer">
                  <button
                    type="button"
                    className="button button-danger-outline"
                    aria-label={`Remove ${item.title} from Saved`}
                    onClick={() => setItemToRemove(item)}
                  >
                    <Icon name="trash" />
                    Remove
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        id="remove-saved-dialog"
        isOpen={itemToRemove !== null}
        title="Remove from Saved?"
        message={dialogMessage}
        confirmLabel="Remove"
        isBusy={isRemoving}
        error={removeError}
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />
    </div>
  );
}

export default SavedPage;
