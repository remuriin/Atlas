# Atlas pages and components

The Atlas frontend has 13 pages in `frontend/src/pages/` and 32 reusable components in `frontend/src/components/`. This page describes each Atlas page (its route, who can open it, what it shows, which API calls it makes, and its main components), then lists every Atlas component by group, with its purpose and its key props.

## How are Atlas pages and components organised?

Each Atlas page is one route in `frontend/src/App.jsx` and lives in `frontend/src/pages/`. A page loads its own data through the service files in `frontend/src/services/`, keeps its state with `useState`, and builds its screen from components in `frontend/src/components/`. Components receive a single `props` object. Components that load or save data (such as `UpvoteButton`, `SaveButton`, `NotesPanel`, and `FlashcardsPanel`) call a service function, never `fetch` directly.

Habits shared by the Atlas pages:

- Each page uses one `PageHeading` as its only h1, which also sets the tab title and moves focus when the page changes.
- Pages that load data keep a `status` value such as `loading`, `ready`, `missing`, or `error`, and draw a different block for each.
- "Try again" buttons add 1 to a `retryCount` state, which runs the loading effect again.
- Loading effects use an `isCancelled` flag, so a late answer from an old request is thrown away.
- A page can hand a one-time success message to the next page through router state (`navigate(path, { state: { flash: '...' } })`), and `FlashMessage` shows it there.

The route table, the login rules, and the pages that are rebuilt on login are in [Atlas frontend architecture](frontend-architecture.md#which-atlas-routes-need-a-login).

## What does the Atlas landing page show?

- Route: `/` (`LandingPage.jsx`). Anyone can open it, but logged-in users are sent straight to `/browse`, unless the previous page handed over a flash message (for example "You are now logged out."). Old feed links that carry feed settings (`sort`, `strand`, `grade`, `quarter`, `subject`, or `q`) are forwarded to `/browse` with the same query.
- What it shows: full-width bands. The hero has the headline "Reviewers for Senior High, made by students", a short lead, "Sign up free" (to `/register`), and "Browse study reviewers" (to `/browse`), beside three example feed cards that are only a drawing and are hidden from screen readers. Then come "Browse by strand" (eight strand cards, each opening the feed filtered to that strand), "Why Atlas" (four highlights with small drawings), "How it works" (Share, Upvote, Study), and a closing band with "Sign up free" and "What you may share" (to `/terms`).
- API calls: none of its own. While Firebase is still checking the login, the page shows a spinner, so logged-in users do not see the pitch for a moment first.
- Main components: `PageHeading`, `FlashMessage`, `Icon`, `Spinner`.

## How does the Atlas feed page at /browse work?

- Route: `/browse` (`HomePage.jsx`). Open to everyone, and rebuilt on login and logout (it gets a user key).
- What it shows: the heading "Study reviewers", a search box (up to 100 characters), four filter menus (Strand, Grade, Quarter, Subject), the "Strand colors" key, the Top and New tabs, a results sentence, and a grid of study reviewer cards with "Load more". Six grey placeholder cards hold the space while it loads. An empty result shows "No study reviewers match" (with "Clear search and filters") or "No study reviewers yet" (with "Share a study reviewer").
- Filters live in the address, for example `/browse?sort=new&strand=STEM&grade=11&q=cells`. Default values are left out, unknown values are ignored, and a subject that the chosen strand does not take is cleared. The Subject menu lists only the chosen strand's subjects. The search runs when Search is pressed, not while typing.
- API calls: `GET /api/reviewers` with `sort`, `page`, and any of `strand`, `grade`, `quarter`, `subject`, and `q`. The server sends 12 cards per page. The page waits until the login is known, so "Upvoted" marks are right the first time. "Load more" asks for the next page, drops cards already shown, and moves focus to the first new card.
- Back button: the list, the scroll position, and the focus come back from `feedMemory.js` without a new request.
- Main components: `FormField`, `StrandLegend`, `TabBar`, `SkeletonList`, `ReviewerList`, `EmptyState`, `FlashMessage`, `Alert`, `PageHeading`.

## What does the Atlas study reviewer page show?

- Route: `/reviewers/:id` (`ReviewerPage.jsx`). Anyone can open it; the buttons depend on who is looking.
- What it shows: a Back link ("Back to study reviewers", or "Back to your profile" when opened from the profile), the title as the h1, the strand pill, the category line (for example "General Chemistry 1 · Grade 11 · Q1 · Summary notes"), and who shared it and when. Then the actions: Upvote and Save for everyone, "Study with notes and flashcards" once saved, Edit and Delete for the uploader, and Report for other logged-in users. Below are "About this study reviewer" (description and tags) and "File" (name, type, size, and an "Open file" or "Download file" link that opens a new tab). The uploader and admins see a note when reports have hidden it.
- API calls: `GET /api/reviewers/:id` (again after a login or logout), and `POST /api/reviewers/:id/view` for logged-in users, which fills "Recently viewed". The uploader's Delete calls `DELETE /api/reviewers/:id` and then opens `/profile` with a flash message. Report calls `POST /api/reviewers/:id/report`; a 409 answer shows "You already reported this study reviewer. An admin will look at it." where the button was. A hidden study reviewer's file is fetched with the login and opened in a new tab.
- A 404 or 400 answer shows "Study reviewer not found".
- Main components: `UpvoteButton`, `SaveButton`, `StrandLink`, `TagList`, `ReportDialog`, `ConfirmDialog`, `FlashMessage`, `Alert`, `Spinner`.

## How does the Atlas login page work?

- Route: `/login` (`LoginPage.jsx`), for visitors. A logged-in person is sent on to the page they came from.
- What it shows: the logo, "Log in", an optional reason from the page that sent them (such as "Log in to upvote study reviewers."), "Continue with Google", then Email, Password (with a Show or Hide button), and "Log in". "Forgot password?" switches to the reset view at `/login?mode=reset`, so the browser's Back button returns to the login form. The reset view asks for the email and answers that a reset email is on its way if there is an account for it, which never reveals whether an account exists.
- Where it returns after login: the `from` path in router state, or the path remembered in `sessionStorage` after a Google sign-in that left the page; otherwise `/`.
- API calls: none to the Atlas API directly. It uses Firebase Authentication (`signInWithEmailAndPassword`, `sendPasswordResetEmail`, and the Google pop-up or redirect). After a login, `AuthContext` loads the profile with `GET /api/me`.
- Checks before sending: an email shape check and a non-empty password. Problems appear in an `ErrorSummary`, and focus moves to the first field with a problem.
- Main components: `FormField`, `ErrorSummary`, `GoogleSignInButton`, `Alert`, `PageHeading`, `Spinner`.

Google sign-in is explained in [How does Google sign-in work on Atlas?](accounts-and-sign-in.md#how-does-google-sign-in-work-on-atlas).

## How does the Atlas register page work?

- Route: `/register` (`RegisterPage.jsx`), for visitors. A logged-in person is sent on to the page they came from.
- What it shows: the logo, "Create an account", "Continue with Google", then Display name (2 to 50 characters, shown next to the person's uploads), Email (only they can see it), Password (at least 8 characters), Confirm password, and "Create account".
- API calls: Firebase `createUserWithEmailAndPassword` and `updateProfile`, then `PUT /api/me` with the display name. The returned profile goes straight into `AuthContext` with `setProfile`, so the header shows the new name at once. A Google account needs no form, because its name and picture come with it.
- Errors: every field is checked before sending. Firebase errors are turned into plain sentences by `describeAuthError` in `authService.js`, for example "An account with that email already exists. Try logging in instead."
- Main components: `FormField`, `ErrorSummary`, `GoogleSignInButton`, `Alert`, `PageHeading`, `Spinner`.

## What does the Atlas terms page say?

- Route: `/terms` (`TermsPage.jsx`). Open to everyone, and linked from the footer, the landing page, and the upload form.
- What it shows: four sections. "What you may share": reviewers, notes, practice tests, and formula sheets you made yourself, or work you have permission to share. "What you may not share": scanned or copied textbooks and modules, paid review-center materials, other people's work without their permission, and offensive content, spam, or files that are not study material. "Who owns what": uploaders keep the rights to their files, let Atlas store and show them, and confirm they made them or may share them. "If your work was shared without permission": email the inbox set in `VITE_TAKEDOWN_EMAIL`, or, when it is empty, log in and choose Report, then Copyright. A file is removed within 7 days if the claim holds, and after 3 reports a study reviewer is hidden until an admin looks at it.
- API calls: none. The page is static text.
- Main components: `PageHeading`.

## How does the Atlas upload page work?

- Route: `/upload` (`UploadPage.jsx`). Login required.
- What it shows: "Share a study reviewer". It first asks `GET /api/me` for `uploadCount` and `uploadLimit`, and the intro says, for example, "You have shared 12 of 50." At the limit it shows a note and a "Go to your profile" link instead of the form, so nobody fills in the form for nothing. If the check fails, the form appears anyway and the server decides.
- The form (`ReviewerForm` in create mode) asks for the title, description, strand, grade, quarter, subject, material type, optional tags, the file, and the box "I made this file, or I have the right to share it". The Subject list depends on the strand. The file is checked as soon as it is picked (type, size, and empty file), and a Word or PowerPoint file gets a note that it can only be downloaded, not opened inside Atlas.
- API calls: `POST /api/reviewers` as multipart form data through `XMLHttpRequest`, with a progress bar. On success the remembered feed is cleared and the new study reviewer's page opens with "Your study reviewer is now shared."
- Main components: `ReviewerForm`, `Alert`, `Spinner`, `PageHeading`.

The server checks every file again; see [How does Atlas check an uploaded file?](uploads-and-file-safety.md#how-does-atlas-check-an-uploaded-file).

## How does the Atlas edit page work?

- Route: `/reviewers/:id/edit` (`EditReviewerPage.jsx`). Login required.
- What it shows: "Edit study reviewer". It loads the study reviewer first. The uploader (`isOwner`) gets the same `ReviewerForm` as the upload page, in edit mode and filled with the saved values. The file field becomes "Replace file" and can stay empty to keep the current file, and the rights box appears only when a new file is chosen. Anyone else sees "You can only edit study reviewers that you uploaded." with a link back. A missing study reviewer shows an error and a "Go to your profile" link.
- API calls: `GET /api/reviewers/:id`, then `PUT /api/reviewers/:id` as multipart form data with a progress bar. Field errors from the server appear next to the matching fields. On success the remembered feed is cleared and the study reviewer's page opens with "Your changes were saved."
- Main components: `ReviewerForm`, `Alert`, `Spinner`, `PageHeading`.

## What does the Atlas profile page show?

- Route: `/profile` (`ProfilePage.jsx`). Login required, and rebuilt on login and logout.
- Account: the avatar (the Google picture, or initials), the display name, how the person signed in, the email ("only you can see this"), "Member since", and a form to change the display name with `PUT /api/me`. The new name also updates the header and the author name on the person's cards.
- Recently viewed: `GET /api/me/recently-viewed` (the last 20), shown as a compact list of links. Opening one makes the study reviewer page's Back link say "Back to your profile".
- My uploads: `GET /api/me/reviewers`, shown as cards with Edit and Delete. Delete asks first in a `ConfirmDialog`, calls `DELETE /api/reviewers/:id`, removes the card from both lists, and moves focus to the "My uploads" heading.
- Delete account: see [How does deleting an account work on the Atlas profile page?](#how-does-deleting-an-account-work-on-the-atlas-profile-page).
- If the profile could not be loaded when the app started, the page tries `GET /api/me` again.
- Main components: `Avatar`, `FormField`, `ReviewerList`, `ConfirmDialog`, `EmptyState`, `FlashMessage`, `Alert`, `Spinner`, `Icon`.

## How does deleting an account work on the Atlas profile page?

The "Delete account" section of the Atlas profile page lists what is removed: the profile, every study reviewer the person shared (and its file), their upvotes, saved list, notes, flashcards, and reports, and their login. Other people keep their own notes on study reviewers they saved from that person. "Delete my account" opens a `ConfirmDialog`. Confirming calls `deleteAccount` in `authService.js`, which first calls `DELETE /api/me` and then deletes the Firebase login. If Firebase refuses that last step, the person is logged out instead; their Atlas data is gone either way.

The server only agrees when the login is less than 5 minutes old. With an older login it answers 401, and the page shows "For your safety, log in again, then delete your account within 5 minutes." with a "Log in again" button. That button logs out, opens `/login` with the message "Log in again to delete your account.", and comes back to `/profile` after the login. After a successful delete, the remembered feed is cleared and the person lands on `/` with the message "Your account and everything in it were deleted."

## What does the Atlas saved page show?

- Route: `/saved` (`SavedPage.jsx`). Login required, and rebuilt on login and logout. Only the owner sees this list.
- What it shows: "Saved study reviewers" and a grid of cards. Each card has the strand pill, the title (a link to the study page at `/saved/:savedId`), the category, the uploader and the file type, whether there are notes, the number of flashcards, and the date it was saved. When the uploader deleted the original, the card says so, and the notes and flashcards stay. Each card has a "Remove" button.
- API calls: `GET /api/me/saved`. "Remove" asks first in a `ConfirmDialog`, warning that the notes and flashcards will be deleted too. It then calls `DELETE /api/saved/:savedId`, clears the remembered feed (so the feed no longer shows "Saved"), announces the removal, and moves focus to the page heading.
- Empty list: "Nothing saved yet" with a "Browse study reviewers" link.
- Main components: `StrandLink`, `ConfirmDialog`, `EmptyState`, `FlashMessage`, `Alert`, `Spinner`, `Icon`.

## How does the Atlas study page work?

- Route: `/saved/:savedId` (`StudyPage.jsx`). Login required, and rebuilt on login and logout. Only the owner of the saved item can open it; for anyone else the API answers 404 and the page says it is not in their list.
- What it shows: "Back to Saved", the title, the strand pill, the subject, and the link "See it in the feed (upvotes, details)". Two tabs follow: "Material and notes" and "Flashcards". The chosen tab lives in the address (`?tab=flashcards`), so the Back button returns to it.
- Material and notes: `FileViewer` shows the file and `NotesPanel` holds the person's notes. On wide screens (64rem and up) they sit side by side, and the notes stay in view while scrolling. The notes stay on the page, only hidden, while the Flashcards tab is open, so notes that are still being saved are never lost.
- Flashcards: `FlashcardsPanel`, drawn only while that tab is open.
- When the uploader deleted the original, a note says the file is gone, the feed link disappears, and no new flashcards can be made.
- API calls: `GET /api/saved/:savedId` for the item and its notes. The panels make their own calls (see [Which Atlas components show the file and the notes?](#which-atlas-components-show-the-file-and-the-notes)).
- Main components: `TabBar`, `FileViewer`, `NotesPanel`, `FlashcardsPanel`, `Alert`, `Spinner`, `Icon`.

## How does the Atlas admin reports page work?

- Route: `/admin` (`AdminPage.jsx`). Login required, and the profile's `role` must be `admin`; everyone else sees "Only admins can see this page." The server answers 403 to non-admins anyway, and the menu shows the Reports link only to admins.
- What it shows: "Reports" and one panel per reported study reviewer: strand, title link, category, uploader, the number of reports, a "Hidden from the feed until you decide." note when 3 open reports have hidden it, and each report's reason, date, and details. Reporters are never shown.
- Actions: "Open file" (fetched with the admin's login and opened in a new tab), "Restore" (show it again and close its reports), "Fix category" (an inline form with Strand, Grade, Quarter, Subject, and Material type; saving moves it and shows it again), and "Delete" (asks first in a `ConfirmDialog`, then removes it and its file).
- API calls: `GET /api/admin/reports`, `POST /api/admin/reviewers/:id/restore`, `PUT /api/admin/reviewers/:id/category`, `DELETE /api/admin/reviewers/:id`, and the file through `GET /api/reviewers/:id/file` with the login. After each action the item leaves the list, a success message is announced, the remembered feed is cleared, and focus moves to the page heading.
- Main components: `StrandLink`, `FormField`, `ConfirmDialog`, `EmptyState`, `Alert`, `Spinner`, `Icon`.

## What does the Atlas not found page show?

- Route: `*` (`NotFoundPage.jsx`), used for any address that matches no other route. Anyone can see it.
- What it shows: a dark panel with the heading "Page not found", the sentence "There is nothing at this address. The link may be old, or it may have a typing mistake.", and a "Browse study reviewers" button that opens `/browse`.
- API calls: none.
- A study reviewer or a saved item that does not exist does not use this page. `ReviewerPage`, `EditReviewerPage`, and `StudyPage` show their own "not found" message instead, because their address pattern still matches.
- Main components: `PageHeading`.

## Which Atlas components handle layout and navigation?

- `Header`: the sticky top bar with the logo, the main menu (Browse, Saved, Upload, Profile, and Reports for admins), "Logged in as" with an `Avatar`, the `ThemeToggle`, and Log in, Sign up, or Log out. Below 48rem the menu hides behind a "Menu" button. "Log out" asks first in a `ConfirmDialog`. No props.
- `Footer`: a short description and links to Browse reviewers, Share a reviewer, and Terms of use and copyright. No props.
- `SkipLink`: "Skip to main content", the first Tab stop. It moves focus to the main element without changing the address. No props.
- `PageHeading`: the page's only h1 (id `page-heading`). It sets the tab title to the page title followed by "· Atlas" and, when the page changes, scrolls to the top and moves focus to the heading. Props: `title`.
- `ProtectedRoute`: shows its children only to logged-in users. It waits for Firebase, then sends visitors to `/login` with a return path. Props: `children`.
- `TabBar`: a row of tabs with the standard arrow-key pattern. Props: `label`, `tabs` (each with `id`, `label`, and an optional `icon`), `activeId`, `panelId`, `onChange`.
- `ThemeToggle`: the "Dark mode" button with `aria-pressed` and a visible On or Off. No props.
- `Avatar`: a round Google profile picture, or the person's initials when there is no picture or it fails to load. Props: `photoUrl`, `name`, `size` (`small` or `large`).

## Which Atlas components show study reviewer cards and lists?

- `ReviewerCard`: one study reviewer as a card with a strand-colored stripe. The whole upper part opens the reviewer through one stretched title link (id `reviewer-link-` plus the reviewer id), which also records the opened card for the Back button. It shows the strand, title, category, a note when reports have hidden it, the description (up to three lines), tags, uploader, date, file type and size, `UpvoteButton`, and `SaveButton`. Props: `reviewer`, `headingLevel` (`h2` or `h3`), `showOwnerActions` (adds Edit and Delete), `onDelete`.
- `ReviewerList`: a grid of `ReviewerCard` items: one column on phones, two from 40rem wide, three from 64rem wide. Props: `items`, `headingLevel`, `showOwnerActions`, `onDelete`.
- `SkeletonList`: grey placeholder cards shown while the feed loads, hidden from screen readers. Props: `count`.
- `StrandLink`: a strand pill inside a 44px tall link that opens the feed filtered to that strand. Props: `strand`.
- `StrandLegend`: the fold-out "Strand colors" key (a native details element). Each entry filters the feed, and the current strand is marked with `aria-current`. Props: `activeStrand`.
- `TagList`: a row of tag pills; each one searches the feed for that word. It draws nothing when there are no tags. Props: `tags`.

## Which Atlas components handle upvote, save, report, and confirm?

- `UpvoteButton`: the only social feature in Atlas. A toggle button (`aria-pressed`) that shows "Upvote" or "Upvoted", an outline or solid arrow, and the count. It sends visitors to log in, calls `PUT` or `DELETE /api/reviewers/:id/upvote`, shows the count the server returns, updates the remembered feed, and announces the change, for example "Upvoted. 5 upvotes." Its accessible name includes the title and the count. Props: `reviewerId`, `title`, `count`, `hasUpvoted`.
- `SaveButton`: "Save" or "Saved" with a bookmark icon. It sends visitors to log in and calls `PUT /api/reviewers/:id/save`. Before unsaving (`DELETE`) it asks first, because unsaving deletes the notes and flashcards. Props: `reviewerId`, `title`, `isSaved`, and an optional `onChange` that receives `isSaved` and `savedId`.
- `ReportDialog`: a native dialog with five reasons (Offensive, Spam, Irrelevant, Wrong category, Copyright), each with a hint, and optional details of up to 500 characters. It starts empty every time it opens. Props: `isOpen`, `title`, `isBusy`, `error`, `onSubmit` (receives the reason and the details), `onCancel`.
- `ConfirmDialog`: the "are you sure?" pop-up for anything that cannot be undone, built on the browser's dialog element opened with `showModal()`. Cancel comes first and gets focus. Props: `id`, `isOpen`, `title`, `message`, `confirmLabel`, `isBusy`, `error`, `onConfirm`, `onCancel`.

## Which Atlas components build forms and sign-in?

- `FormField`: one labelled field with an optional hint and error message, both tied to the input with `aria-describedby`, and "(required)" in the label when needed. Types: `text` (the default), `email`, `password` (with a Show or Hide button), `search`, `number`, `textarea`, `select`, and `file`. Props: `id`, `label`, `type`, `value`, `onChange`, `required`, `hint`, `error`, `autoComplete`, `options` and `placeholderOption` (for select), `accept` (for file), `maxLength`, `rows`, `min`, `max`, `step`, `inputMode`.
- `ErrorSummary`: the box at the top of a form after a failed submit, for example "There are 3 problems to fix", with each problem as a link that puts the cursor in its field. Props: `errors` (a list of objects with `fieldId` and `message`).
- `ReviewerForm`: the upload and edit form for a study reviewer, with every field check, the early file check, the rights checkbox, and the upload progress bar. Props: `mode` (`create` or `edit`), and `reviewer` (edit mode only).
- `GoogleSignInButton`: "Continue with Google" on the login and register pages. It never locks, because pressing it again simply opens a fresh Google window. Props: `returnPath` (used if the pop-up is blocked and the whole page goes to Google), `onError` (receives a plain-language message, or an empty string to clear it).

## Which Atlas components show messages and loading states?

- `Alert`: a message box of type `error`, `success`, or `info`, with an icon and the word "Error:", "Success:", or "Note:" in front, so the meaning never depends on color. Errors use `role="alert"`; the others use `role="status"`. Props: `type`, `children`, and an optional `onDismiss` that adds a "Dismiss message" close button.
- `FlashMessage`: shows a one-time success message handed over in router state (`flash`), then erases it from the history entry, so a reload does not show it again. Dismissing it moves focus to the page heading. No props.
- `EmptyState`: a friendly box for an empty list, with an icon, a title, a message, and any links or buttons placed inside it. Props: `icon`, `title`, `message`, `children`.
- `Spinner`: a spinning ring (decoration only) and a label that screen readers read from a `role="status"` region. Props: `label` (default "Loading…").
- `Icon`: one small inline SVG icon from a fixed set of 31 names (for example `arrow-up`, `bookmark`, and `trash`). Icons are always hidden from screen readers, because the visible text beside them carries the meaning. Props: `name`, `filled` (a solid icon, for pressed states), `large`.

## Which Atlas components show the file and the notes?

- `FileViewer`: shows a saved study reviewer's file inside the study page: a PDF in a frame (the browser's own PDF viewer), a PNG or JPG as a picture, and a text file as plain text. Word and PowerPoint files can only be downloaded. It fetches the file once with `GET /api/reviewers/:id/file` (with the login); a PDF or picture is shown from a temporary object URL that is freed when the page closes. It also offers "Download file" and "Open in new tab". Props: `item` (the saved item; `item.reviewer` is `null` when the original was removed).
- `NotesPanel`: the person's own notes. They are saved with `PUT /api/saved/:savedId/notes` 1.5 seconds after typing stops, and sent once more if the person leaves the page within that moment. It shows the save status, a character count (up to 20,000 visible characters), "Save now", and "Download notes" (a `.txt` file). The browser asks before closing a tab with unsaved notes. Props: `savedId`, `title`, `initialNotes`, `initialFormat` (`html`, or `text` for old notes), `initialSavedAt`.
- `NoteEditor`: the editor inside `NotesPanel`, with bold, italic, three heading sizes, bullets, indents, 5 text colors, and 5 highlights. It uses the browser's `contentEditable` and `document.execCommand`, and `services/noteHtml.js` cleans what it produces. Pasted text arrives as plain text, and dropping content is turned off. Props: `id`, `labelId`, `hintId`, `initialNotes`, `initialFormat`, `onReady`, `onChange`.

## Which Atlas components handle flashcards?

- `FlashcardsPanel`: the Flashcards tab of the study page. When there are no cards it explains that AI (Google Gemini) writes them and can make mistakes, and offers "Make flashcards" with a number from 5 to 100 (default 20). That calls `POST /api/saved/:savedId/flashcards`, and the panel warns that it can take up to two minutes. Short material gives fewer cards instead of filler, and the panel says so. With cards it shows progress tiles (Not studied, Learning, Learned), Shuffle, "Only cards not learned yet", the card position, Previous and Next, and "Still learning" and "Got it", which save the card's status with `PUT /api/saved/:savedId/flashcards/:cardId`. "Make a new set" (it asks first, because progress is lost) and "Delete flashcards" are under "Manage this set". Props: `savedId`, `title`, `canMake` (`false` when the original file was removed).
- `Flashcard`: one card that turns over when pressed, with the question on the front and the answer on the back. It is a single button, so Space and Enter turn it too, and only the side facing up is read by screen readers. Props: `card` (with `front` and `back`), `isFlipped`, `onFlip`.

How the server makes the cards is in [How does Atlas make flashcards?](flashcards.md#how-does-atlas-make-flashcards).
