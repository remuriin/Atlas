// The feed: browse study reviewers by tab, subject, and search.
//
// The chosen tab, subject, and search words live in the page address
// (for example /?sort=new&subject=Science). That way the browser's Back button
// brings them back, and a filtered list can be bookmarked or shared.
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { listReviewers } from '../services/reviewersService';
import { SUBJECTS } from '../services/subjects';
import { countLabel } from '../services/format';
import {
  getOpenedReviewerId,
  getRememberedScroll,
  readFeed,
  rememberScroll,
  saveFeed,
} from '../services/feedMemory';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import FlashMessage from '../components/FlashMessage';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import ReviewerList from '../components/ReviewerList';
import SkeletonList from '../components/SkeletonList';
import SubjectLegend from '../components/SubjectLegend';
import TabBar from '../components/TabBar';

const TABS = [
  { id: 'top', label: 'Top', icon: 'arrow-up' },
  { id: 'new', label: 'New', icon: 'clock' },
];

const SEARCH_MAX = 100;

function HomePage() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // What the visitor has chosen, read from the address. Anything unexpected
  // (someone editing the address by hand) falls back to the default.
  let sort = 'top';
  if (searchParams.get('sort') === 'new') {
    sort = 'new';
  }
  let subject = searchParams.get('subject') || '';
  if (SUBJECTS.indexOf(subject) === -1) {
    subject = '';
  }
  const query = (searchParams.get('q') || '').trim().slice(0, SEARCH_MAX);
  // One piece of text that changes whenever any of the three choices changes.
  const filterKey = `${sort}|${subject}|${query}`;

  let userId = 'visitor';
  if (auth.firebaseUser) {
    userId = auth.firebaseUser.uid;
  }

  // When arriving here with the Back button, this is the list as it was left.
  // It is only used for the starting values below.
  const remembered = readFeed(location.key, location.search, userId);
  let startItems = [];
  let startPage = 1;
  let startHasMore = false;
  let startStatus = 'loading';
  if (remembered) {
    startItems = remembered.items;
    startPage = remembered.page;
    startHasMore = remembered.hasMore;
    startStatus = 'ready';
  }

  // What is typed in the search box (the address only changes when Search is pressed).
  const [searchInput, setSearchInput] = useState(query);
  // The page number is stored together with the filters it belongs to. When
  // the filters change, the stored key no longer matches and we are on page 1 again.
  const [pageState, setPageState] = useState({ filterKey: filterKey, page: startPage });
  let page = 1;
  if (pageState.filterKey === filterKey) {
    page = pageState.page;
  }

  // What came back from the server.
  const [items, setItems] = useState(startItems);
  const [hasMore, setHasMore] = useState(startHasMore);
  // status is 'loading', 'ready', or 'error' and describes the first page.
  const [status, setStatus] = useState(startStatus);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  // Changing this number runs the loading effect again (used by "Try again").
  const [retryCount, setRetryCount] = useState(0);
  // After "Load more", focus moves to the first new card.
  const [focusReviewerId, setFocusReviewerId] = useState(null);
  // True when the list above came from memory, so there is nothing to load yet.
  const [isUsingRemembered, setIsUsingRemembered] = useState(Boolean(remembered));

  // Loads one page whenever a choice changes. Page 1 replaces the list;
  // later pages are added to the end of it.
  useEffect(() => {
    // Wait until we know who is logged in, so "Upvoted" marks are right first time.
    if (auth.isLoading) {
      return undefined;
    }

    // The filters changed, so the old page number no longer applies. Reset the
    // stored copy too; otherwise going back to earlier filters later on would
    // wake up their old page number and skip page 1.
    if (pageState.filterKey !== filterKey) {
      setPageState({ filterKey: filterKey, page: 1 });
    }

    // The remembered list is already on screen. Skip this one load only.
    if (isUsingRemembered) {
      setIsUsingRemembered(false);
      return undefined;
    }

    // If the visitor changes a filter before this request finishes, the cleanup
    // function below sets this flag and the late answer is thrown away.
    let isCancelled = false;

    const loadPage = async () => {
      if (page === 1) {
        setStatus('loading');
      } else {
        setIsLoadingMore(true);
      }
      setLoadMoreError('');

      try {
        const data = await listReviewers({ sort: sort, subject: subject, q: query, page: page });
        if (isCancelled) {
          return;
        }

        if (page === 1) {
          setItems(data.items);
          setStatus('ready');
        } else {
          // If new reviewers were posted in the meantime, the server's pages shift
          // and one could arrive twice. Keep only the ones not already shown.
          const newItems = data.items.filter((newItem) => {
            return !items.find((shownItem) => shownItem.id === newItem.id);
          });
          setItems(items.concat(newItems));
          if (newItems.length > 0) {
            setFocusReviewerId(newItems[0].id);
          }
        }
        setHasMore(data.hasMore);
      } catch (err) {
        if (isCancelled) {
          return;
        }
        if (page === 1) {
          setErrorMessage(err.message);
          setStatus('error');
        } else {
          setLoadMoreError(err.message);
        }
      }
      setIsLoadingMore(false);
    };

    loadPage();

    return () => {
      isCancelled = true;
    };
  }, [sort, subject, query, page, retryCount, auth.isLoading]);

  // Keep the search box in step with the address, for example after Back
  // or after choosing a tag on a card.
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Move focus to the first newly loaded card, so keyboard and screen reader
  // users continue from the new content instead of being left at the button.
  useEffect(() => {
    if (focusReviewerId === null) {
      return;
    }
    const link = document.getElementById(`reviewer-link-${focusReviewerId}`);
    if (link) {
      link.focus();
    }
  }, [focusReviewerId]);

  // Remember the list every time it changes, ready for a later Back.
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    saveFeed({
      locationKey: location.key,
      search: location.search,
      userId: userId,
      items: items,
      page: page,
      hasMore: hasMore,
    });
  }, [status, items, page, hasMore, location.key, location.search, userId]);

  // Remember how far down the list the visitor has scrolled.
  useEffect(() => {
    const handleScroll = () => {
      // While leaving, the browser reports a scroll for the page that is
      // replacing this one. Only count scrolling while the feed is on screen.
      if (document.getElementById('feed-panel')) {
        rememberScroll(window.scrollY);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // The address changed while the feed was already open: a tab, a filter, a tag
  // on a card, or the Browse link. Show the new list from its top.
  useEffect(() => {
    // "default" is the very first page load, which needs no adjusting.
    if (location.key === 'default') {
      return;
    }
    window.scrollTo(0, 0);

    // If the change was made with the tabs, the subject menu, or the search
    // box, focus is already in the right place and must stay there.
    const controls = document.getElementById('feed-controls');
    if (controls && controls.contains(document.activeElement)) {
      return;
    }
    // Otherwise (for example a tag far down the list was chosen, and that card
    // is now gone) start again from the heading, as on any new page.
    const heading = document.getElementById('page-heading');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, [location.key]);

  // Arrived with Back: put the visitor exactly where they were, with focus on
  // the card they had opened. Runs once, after the remembered list is on screen.
  useEffect(() => {
    if (!remembered) {
      return;
    }
    window.scrollTo(0, getRememberedScroll());
    const link = document.getElementById(`reviewer-link-${getOpenedReviewerId()}`);
    if (link) {
      // The scroll position was just restored, so focusing must not move it.
      link.focus({ preventScroll: true });
    }
  }, []);

  // Writes the choices into the address. Default values are left out to keep it short.
  const applyFilters = (nextSort, nextSubject, nextQuery) => {
    const nextParams = {};
    if (nextSort !== 'top') {
      nextParams.sort = nextSort;
    }
    if (nextSubject !== '') {
      nextParams.subject = nextSubject;
    }
    if (nextQuery !== '') {
      nextParams.q = nextQuery;
    }
    setSearchParams(nextParams);
  };

  const handleTabChange = (tabId) => {
    applyFilters(tabId, subject, query);
  };

  const handleSubjectChange = (event) => {
    applyFilters(sort, event.target.value, query);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    applyFilters(sort, subject, searchInput.trim().slice(0, SEARCH_MAX));
  };

  const handleClearFilters = () => {
    setSearchInput('');
    applyFilters(sort, '', '');
    // The Clear button disappears once the filters are gone, so park focus
    // on the search box instead of letting it get lost.
    const searchBox = document.getElementById('feed-search');
    if (searchBox) {
      searchBox.focus();
    }
  };

  const handleLoadMore = () => {
    if (isLoadingMore) {
      return;
    }
    if (loadMoreError !== '') {
      // The last attempt failed, so ask for the same page again.
      setRetryCount(retryCount + 1);
    } else {
      setPageState({ filterKey: filterKey, page: page + 1 });
    }
  };

  const hasFilters = subject !== '' || query !== '';

  // One sentence that describes the list. It sits in a live region, so screen
  // readers hear it whenever the results change.
  let resultsText = '';
  if (status === 'loading') {
    resultsText = 'Loading study reviewers…';
  } else if (status === 'ready') {
    resultsText = `Showing ${countLabel(items.length, 'study reviewer', 'study reviewers')}`;
    if (query !== '') {
      resultsText = `${resultsText} for “${query}”`;
    }
    if (subject !== '') {
      resultsText = `${resultsText} in ${subject}`;
    }
    resultsText = `${resultsText}.`;
    if (!hasMore && items.length > 0 && page > 1) {
      resultsText = `${resultsText} That is all of them.`;
    }
  }

  let loadMoreText = 'Load more';
  if (isLoadingMore) {
    loadMoreText = 'Loading more…';
  } else if (loadMoreError !== '') {
    loadMoreText = 'Try again';
  }

  return (
    <div className="feed-page">
      <PageHeading title="Study reviewers" />
      <p className="page-intro">
        Notes, study guides, and review files made by learners. Upvote the ones that help you.
      </p>

      <div className="flash-slot">
        <FlashMessage />
      </div>

      <div id="feed-controls">
        <div className="feed-toolbar">
          <form className="search-form" role="search" onSubmit={handleSearchSubmit}>
            <label className="field__label" htmlFor="feed-search">
              Search study reviewers
            </label>
            <div className="search-form__row">
              <input
                id="feed-search"
                className="input"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={SEARCH_MAX}
                autoComplete="off"
              />
              <button type="submit" className="button">
                <Icon name="search" />
                Search
              </button>
            </div>
          </form>

          <div className="feed-toolbar__filter">
            <FormField
              id="feed-subject"
              label="Subject"
              type="select"
              value={subject}
              onChange={handleSubjectChange}
              options={SUBJECTS}
              placeholderOption="All subjects"
            />
          </div>
        </div>

        <SubjectLegend activeSubject={subject} />

        <TabBar
          label="Sort study reviewers"
          tabs={TABS}
          activeId={sort}
          panelId="feed-panel"
          onChange={handleTabChange}
        />
      </div>

      <div id="feed-panel" role="tabpanel" aria-labelledby={`tab-${sort}`}>
        <div className="feed-status">
          <p role="status">{resultsText}</p>
          {hasFilters && (
            <button type="button" className="link-button" onClick={handleClearFilters}>
              Clear search and filters
            </button>
          )}
        </div>

        {/* Grey placeholder cards hold the space, so the page does not jump
            when the real cards arrive. */}
        {status === 'loading' && <SkeletonList count={6} />}

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

        {status === 'ready' && items.length === 0 && hasFilters && (
          <EmptyState
            icon="search"
            title="No study reviewers match"
            message="Try a different word, another subject, or another tab."
          >
            <button type="button" className="button" onClick={handleClearFilters}>
              Clear search and filters
            </button>
          </EmptyState>
        )}

        {status === 'ready' && items.length === 0 && !hasFilters && (
          <EmptyState
            icon="file"
            title="No study reviewers yet"
            message="Be the first to share your notes or study guide."
          >
            <Link className="button button--primary" to="/upload">
              <Icon name="upload" />
              Share a study reviewer
            </Link>
          </EmptyState>
        )}

        {status === 'ready' && items.length > 0 && (
          <ReviewerList items={items} headingLevel="h2" />
        )}

        {status === 'ready' && (hasMore || loadMoreError !== '') && (
          <div className="load-more">
            {loadMoreError !== '' && <Alert type="error">{loadMoreError}</Alert>}
            <button
              type="button"
              className="button"
              aria-disabled={isLoadingMore}
              onClick={handleLoadMore}
            >
              {loadMoreText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
