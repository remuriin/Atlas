// The study page for one saved study reviewer: the file and your notes side by
// side, and a second tab with flashcards. The chosen tab lives in the address
// (/saved/12?tab=flashcards), so the browser's Back button brings it back.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getSavedItem } from '../services/savedService';
import { strandSlug } from '../services/categories';
import Alert from '../components/Alert';
import FileViewer from '../components/FileViewer';
import FlashcardsPanel from '../components/FlashcardsPanel';
import Icon from '../components/Icon';
import NotesPanel from '../components/NotesPanel';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';
import TabBar from '../components/TabBar';

const TABS = [
  { id: 'material', label: 'Material and notes', icon: 'file' },
  { id: 'flashcards', label: 'Flashcards', icon: 'cards' },
];

function StudyPage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  let tab = 'material';
  if (searchParams.get('tab') === 'flashcards') {
    tab = 'flashcards';
  }

  const [item, setItem] = useState(null);
  // status is 'loading', 'ready', 'missing', or 'error'.
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const loadItem = async () => {
      setStatus('loading');
      try {
        const data = await getSavedItem(params.savedId);
        if (isCancelled) {
          return;
        }
        setItem(data);
        setStatus('ready');
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

    loadItem();

    return () => {
      isCancelled = true;
    };
  }, [params.savedId, retryCount]);

  const handleTabChange = (tabId) => {
    if (tabId === 'flashcards') {
      setSearchParams({ tab: 'flashcards' });
    } else {
      setSearchParams({});
    }
  };

  let headingText = 'Loading saved study reviewer…';
  if (status === 'ready') {
    headingText = item.title;
  } else if (status === 'missing') {
    headingText = 'Saved study reviewer not found';
  } else if (status === 'error') {
    headingText = 'Saved study reviewer';
  }

  return (
    <div className="stack study-page">
      <div>
        <Link className="back-link" to="/saved">
          <Icon name="arrow-left" />
          Back to Saved
        </Link>
        <PageHeading title={headingText} />
      </div>

      {status === 'loading' && <Spinner label="Loading saved study reviewer…" />}

      {status === 'missing' && (
        <div className="stack">
          <p>This saved study reviewer is not in your list. It may have been removed.</p>
          <div>
            <Link className="button" to="/saved">
              Go to Saved
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
        <>
          <div className="row">
            <span className={`label label--strand strand--${strandSlug(item.strand)}`}>
              <span className="visually-hidden">Strand: </span>
              {item.strand}
            </span>
            <span className="text-small">{item.subject}</span>
            {!item.isRemoved && (
              <Link className="text-small" to={`/reviewers/${item.reviewerId}`}>
                See it in the feed (upvotes, details)
              </Link>
            )}
          </div>

          {item.isRemoved && (
            <Alert type="info">
              The uploader removed the original, so its file is no longer available. Your notes
              and flashcards are still yours.
            </Alert>
          )}

          <TabBar
            label="Study tools"
            tabs={TABS}
            activeId={tab}
            panelId="study-panel"
            onChange={handleTabChange}
          />

          <div id="study-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {/* The notes stay on the page (only hidden) while flashcards are shown,
                so switching tabs never throws away notes that are still being saved. */}
            <div className="study-layout" hidden={tab !== 'material'}>
              <FileViewer item={item} />
              <NotesPanel
                savedId={item.id}
                title={item.title}
                initialNotes={item.notes}
                initialFormat={item.notesFormat}
                initialSavedAt={item.notesUpdatedAt}
              />
            </div>

            {tab === 'flashcards' && (
              <FlashcardsPanel savedId={item.id} title={item.title} canMake={!item.isRemoved} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StudyPage;
