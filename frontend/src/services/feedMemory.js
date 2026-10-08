// Remembers the feed while you look at something else, so the browser's Back
// button returns you to the same list, at the same scroll position, instead of
// starting again from the top.
//
// This is plain memory (not saved anywhere). It is gone after a page reload,
// which is fine: a reload is expected to show fresh results.

// A list older than this is thrown away and loaded again.
const MAX_AGE_MS = 10 * 60 * 1000;

let savedFeed = null;
let savedScrollY = 0;
let openedReviewerId = null;

// feed: { locationKey, search, userId, items, page, hasMore }
export const saveFeed = (feed) => {
  savedFeed = {
    locationKey: feed.locationKey,
    search: feed.search,
    userId: feed.userId,
    items: feed.items,
    page: feed.page,
    hasMore: feed.hasMore,
    savedAt: Date.now(),
  };
};

// Returns the remembered feed, or null when it does not belong to this exact
// visit. React Router gives every entry in the browser history its own key, so
// a matching key means "you came back to this entry", not "you opened the feed again".
export const readFeed = (locationKey, search, userId) => {
  if (!savedFeed) {
    return null;
  }
  if (savedFeed.locationKey !== locationKey || savedFeed.search !== search) {
    return null;
  }
  // Upvote marks belong to one person, so never show them to someone else.
  if (savedFeed.userId !== userId) {
    return null;
  }
  if (Date.now() - savedFeed.savedAt > MAX_AGE_MS) {
    return null;
  }
  return savedFeed;
};

export const clearFeed = () => {
  savedFeed = null;
};

export const rememberScroll = (scrollY) => {
  savedScrollY = scrollY;
};

export const getRememberedScroll = () => {
  return savedScrollY;
};

// Which card was opened, so focus can return to it after Back.
export const rememberOpenedReviewer = (reviewerId) => {
  openedReviewerId = reviewerId;
};

export const getOpenedReviewerId = () => {
  return openedReviewerId;
};

// Called after an upvote anywhere in the app (for example on a reviewer's own
// page), so the remembered list shows the new count when you go back to it.
export const updateRememberedUpvote = (reviewerId, upvoteCount, hasUpvoted) => {
  if (!savedFeed) {
    return;
  }
  savedFeed.items = savedFeed.items.map((item) => {
    if (item.id !== reviewerId) {
      return item;
    }
    return Object.assign({}, item, { upvoteCount: upvoteCount, hasUpvoted: hasUpvoted });
  });
};
