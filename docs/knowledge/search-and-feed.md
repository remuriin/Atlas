# Search and the feed in Atlas

The feed is the Atlas page where students browse and search study reviewers, at the address `/browse`. This page explains the Top and New tabs, paging with Load more, the strand, grade, quarter and subject filters, how search finds and ranks study reviewers, what choosing a tag does, and how the feed remembers your place when you press Back. Search is described as in the newest code, in `backend/src/utils/validate.js` and `backend/src/models/reviewersModel.js`.

## What is the Atlas feed?

The Atlas feed lives at `/browse` (`frontend/src/pages/HomePage.jsx`). The address `/` is a landing page for new visitors, and logged-in users who open `/` go straight to `/browse`. Anyone can browse and search the feed without logging in; upvoting and saving need a login. Each study reviewer appears as a card with its strand pill, title, category (subject, grade, quarter and material type), description, tags, uploader's name, posting date, file type and size, upvote count and Save button. The whole upper part of a card opens the study reviewer's own page. Above the cards sit the search box, four filter menus, a fold-out "Strand colors" key and the Top and New tabs. The page gets its cards from `GET /api/reviewers`, which answers with `items`, `page` and `hasMore`.

## What is the difference between Top and New in the Atlas feed?

The Atlas feed has two tabs that show the same study reviewers in a different order:

- Top, the default: most upvotes first; study reviewers with equal upvotes are ordered newest first.
- New: newest first, by the time each study reviewer was posted.

If two posting times are equal, the study reviewer with the higher id comes first. Upvotes are counted fresh from the upvotes table on every request and never stored as a number. While a search is active, both tabs first sort by how well each study reviewer matches the search, and use their own order only for study reviewers with the same match score (see [how search results are ranked](#how-are-search-results-ranked)). The tab is kept in the address as `sort=new`; Top is the default and is left out of the address. Any other value of `sort` makes the API answer 400 `"sort" must be top or new.`

## How does Load more work in the Atlas feed?

The Atlas feed loads 12 study reviewers at a time. The API reads `page`, starting at 1, and an optional `limit` (12 by default; anything above 50 is treated as 50). Both must be whole numbers of 1 or more, or the API answers 400. To know whether more cards exist without counting them all, the server asks the database for one row more than the limit: if that extra row comes back, `hasMore` is true, and the extra row is dropped from the answer. While `hasMore` is true, a Load more button appears under the cards. It adds the next page to the end of the list and moves keyboard focus to the first new card. If new study reviewers were posted in the meantime, the pages shift and a card could arrive twice, so the page drops cards it already shows. After the last page has been loaded with Load more, the status line adds "That is all of them." If loading fails, the button turns into Try again.

## How do the Atlas feed filters work?

The Atlas feed has four filter menus, each starting at an "Any" choice:

- Strand: All strands, STEM, ABM, HUMSS, GAS, TVL, Arts and Design, Sports.
- Grade: 11 or 12.
- Quarter: 1st, 2nd, 3rd or 4th.
- Subject: every subject, or only the subjects of the chosen strand.

Filters combine: a study reviewer must match every chosen filter. Choosing a strand also shows the study reviewers filed under "All strands", because every strand takes those core and applied subjects; choosing "All strands" itself shows only those. Changing the strand clears a chosen subject that the new strand does not take. A filter value that is not on its list, for example from an old bookmark or a hand-edited address, is ignored by both the page and the server (`parseFilter` in `backend/src/utils/validate.js`), so the feed still loads. Strand pills on cards and the entries of the "Strand colors" key are links that open the feed filtered to that strand. "Clear search and filters" empties the search box and every filter but keeps the chosen tab.

## How does Atlas search match study reviewers?

Atlas search looks for words, not for the whole phrase. The server (`buildSearchWords` in `backend/src/utils/validate.js`) trims the search text, keeps its first 100 characters, splits it at spaces and uses at most the first 8 words. Each word must be found at the start of a word, ignoring capital letters: "chem" finds "Chemistry", and "stem" finds "STEM" but not "systems". A study reviewer matches only when every word is found somewhere in its title, description, tags, subject, strand, material type and uploader's name taken together (`FILTER_BY_CATEGORY_AND_SEARCH` in `backend/src/models/reviewersModel.js`). The words do not have to be next to each other or in the same field. Characters with a special meaning in a search pattern, such as `+`, `(` or `.`, are escaped, so "c++" or "(2)" look for those exact characters; a word that starts with a symbol, like "(2)", is looked for anywhere instead of at the start of a word. The text inside the uploaded file is not searched, and neither are the grade and the quarter: use the filters for those.

## How are search results ranked?

While searching, Atlas gives every matching study reviewer a score (`SEARCH_SCORE` in `backend/src/models/reviewersModel.js`) and lists the highest scores first:

- +100 points when the title starts with the search text itself (`buildSearchStart`): the same words in the same order, where any run of spaces counts as one and the last word may be the start of a longer word. Searching "c" therefore lists titles that begin with C first.
- Then, for each search word, points for the best place it was found: +3 in the title, +2 in the tags or the subject, +1 anywhere else (description, strand, material type or uploader's name).

Study reviewers with the same score keep the tab's own order: Top sorts them by upvotes and then by date, New by date. Without a search every study reviewer scores 0, so the tabs use only their own order. Upvotes never outrank the match score: a study reviewer whose title starts with the search comes before a more upvoted one whose title does not.

## Can you show an example of how Atlas ranks a search?

Suppose a student searches `general chemistry`, two words, and four study reviewers match:

| Study reviewer | Where the words are found | Score |
| --- | --- | --- |
| Title "General Chemistry 1 Quarter 2 Reviewer" | The title starts with the search (+100), and both words are in the title (+3 +3) | 106 |
| Title "My General Chemistry Notes" | Both words are in the title, which does not start with them (+3 +3) | 6 |
| Title "Stoichiometry Practice Test", subject "General Chemistry 1" | Both words only in the subject (+2 +2) | 4 |
| Title "Gas Laws Summary", subject "Physical Science", description mentions general chemistry | Both words only in the description (+1 +1) | 2 |

Atlas lists them in that order on both tabs, whatever their upvotes. A fifth study reviewer that contains "chemistry" but not "general" is not shown at all, because every word must be found. If two study reviewers both scored 6, Top would put the one with more upvotes first and New the newer one.

## What happens when I choose a tag in Atlas?

Tags appear as small chips on each card and on a study reviewer's page (`frontend/src/components/TagList.jsx`). Choosing a tag opens the Atlas feed with that tag as the search, for example `/browse?q=limits`. It is a normal search, not an exact tag filter: it also finds study reviewers that mention the word in their title, description or another searched field without having the tag, and a two-word tag such as "quarterly exam" needs both words. Tags are stored in lowercase and separated by commas, so every tag starts a new word and is found by the start-of-word matching. An uploader can give up to 8 tags of at most 30 characters each.

## Where does the Atlas feed keep my choices?

The Atlas feed keeps the tab, the filters and the search words in the page address, for example `/browse?sort=new&strand=STEM&grade=11&q=cells`. Default values are left out to keep the address short. Because the choices live in the address, a filtered list can be bookmarked or shared, and the browser's Back button steps back through earlier filter changes. Typing in the search box does not change the list by itself: the address and the results change only when Search (or Enter) is pressed, so there is no search-as-you-type. After a page reload the choices come back from the address, but the list starts again at page 1.

## How does the Atlas feed remember my place when I press Back?

When you open a study reviewer from the Atlas feed and come back with the page's Back link or the browser's Back button, the feed shows the same loaded cards at the same scroll position, with keyboard focus on the card you opened, without asking the server again. `frontend/src/services/feedMemory.js` keeps the cards, the page number, whether more pages exist, the scroll position and the opened card in the page's memory, not in browser storage. The remembered list is reused only when all of these hold:

- It is the same entry in the browser history, with the same address.
- The same person is logged in, or still nobody, because upvote marks belong to one person.
- It is at most 10 minutes old.
- The page was not reloaded; a reload empties the memory.

Upvoting or saving a study reviewer elsewhere in Atlas updates the remembered cards. Sharing, editing or deleting a study reviewer, removing a saved one, admin actions and deleting your account clear the memory, so the next visit loads fresh results. Opening the feed fresh from the menu also loads a new list.

## Do hidden study reviewers appear in the Atlas feed or search?

No. A study reviewer hidden by reports (see [what hidden means](reports-and-moderation.md#what-does-hidden-mean-for-everyone)) never appears in the Atlas feed or in search results, for anyone: the feed query only lists study reviewers with `is_hidden = false`, and this holds for the uploader and the admins too. Hidden study reviewers are also left out of everyone's Recently viewed list. The uploader still sees a hidden one on their own profile, with the note "Hidden while an admin looks at reports about it.", and admins find it on the Reports page at `/admin`. Once an admin restores it or fixes its category, it returns to the feed and to search results with its upvotes intact.

## What are the limits of Atlas search?

Atlas search is simple word matching, so it has these limits:

- No typo tolerance: "chemestry" does not find "chemistry".
- No stemming or synonyms: each word only matches the start of a word, so "cell" finds "cells", but "cells" does not find "cell", and "maths" does not find "mathematics".
- No language rules: English and Filipino words are treated alike, as plain letters. No common words are skipped, so words like "the", "and", "ng" or "sa" must be found too. An accented letter such as "ñ" is not matched by a plain "n".
- Only the first 8 words and the first 100 characters of a search are used.
- The text inside uploaded files is not searched, and neither are grade and quarter.
- There is no search index: on each search the database reads the text of every visible study reviewer that passes the filters, which is fine for a school-sized collection but would slow down with very many study reviewers.
- The new ranking on this page, with word-start matching and titles that start with the search ranked first, is not live yet: on 2026-11-01 it is not merged or deployed, so live search results can differ from what this page describes.

## What are the limits of the Atlas feed?

The Atlas feed is built to stay simple, which brings these limits:

- Each card costs two extra small database queries for a logged-in visitor, one for "have I upvoted this?" and one for "have I saved this?" (`buildReviewerItems` in `backend/src/utils/reviewerItems.js`). Visitors who are not logged in need none, and a page has at most 50 cards.
- Pages are counted by position, so the list can shift between Load more clicks: new uploads push cards down (the page drops the repeats), a study reviewer deleted or hidden in the meantime can make one card be skipped, and new upvotes can move cards on the Top tab.
- There is no total count and no endless scrolling: the feed only knows whether at least one more card exists.
- The remembered list for the Back button lives only in the page's memory, for at most 10 minutes; after a reload the list starts again from page 1.
