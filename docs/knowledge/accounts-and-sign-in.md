# Accounts and sign-in

This document explains how accounts work on Atlas: signing up and logging in with email and password or Google, resetting a password, how the Atlas API knows who you are, what Atlas stores about you, admins, deleting an account, the Firebase Authentication settings, and the local Auth emulator.

## How do I create an Atlas account?

Choose "Sign up" in the Atlas header, or "Sign up free" on the front page, to open "Create an account" at /register. There are two ways to sign up:

- Continue with Google: no form to fill in. Your Google name and picture come with the account.
- Email and password: fill in Display name (2 to 50 characters, shown next to the study reviewers you share), Email (only you can see it; it is used to log in and to reset your password), Password (at least 8 characters) and Confirm password, then press "Create account".

Firebase Authentication creates the login. Atlas then saves your display name on the Firebase account and in your Atlas profile (`PUT /api/me`), and sends you back to the page you came from. Atlas accounts are free. Atlas does not send a confirmation email, and there is no separate sign-up for admins.

## How do I log in to Atlas?

Choose "Log in" in the Atlas header to open /login. Press "Continue with Google", or type your email and password and press "Log in". Wrong details show "The email or password is not correct.", and too many tries show "Too many attempts. Please wait a few minutes and try again."

Pages that need an account (Upload, Saved, Profile, Edit and Reports) send visitors to the Log in page with "Log in to continue.", and bring them back to the same page after they log in. Firebase keeps you logged in on that browser until you log out. After a page reload, Atlas briefly shows "Checking your login…" while Firebase restores the session.

## How does Google sign-in work on Atlas?

"Continue with Google" is on both the Log in page and the Create an account page. It opens Google's account chooser in a small pop-up window, so people with several Google accounts can pick one (`prompt: 'select_account'`). If the browser blocks the pop-up, Atlas sends the whole tab to Google instead (a redirect) and remembers which page to return to in the tab's session storage (`atlas-return-path`). Closing the pop-up on purpose shows no error.

A new Google user gets an Atlas profile with their Google name. The Google profile picture shows in the header and on the Profile page; other accounts get a circle with their initials. According to the README, a Google sign-in with the same email as an existing account opens that same account. If Firebase instead reports that the email belongs to an account with another sign-in method, Atlas says "An account with this email already exists. Log in with your email and password instead." The code is in `frontend/src/services/authService.js` and `frontend/src/components/GoogleSignInButton.jsx`.

## How do I reset my Atlas password?

On the Atlas Log in page, press "Forgot password?". This opens the reset view at /login?mode=reset. Enter the email you signed up with and press "Email me a reset link". Firebase Authentication then sends an email with a link for choosing a new password.

Atlas always answers "If there is an account for (your email), a reset email is on its way. Check your inbox and your spam folder." It says this even when no account exists, so strangers cannot use the form to find out who has an Atlas account. "Back to log in" returns to the login form. Atlas has no page for changing your password or your email while you are logged in; the reset email is the only way to change a password.

## How does Atlas know who I am?

After you sign in, Firebase Authentication gives the browser an ID token: a signed pass that says which Firebase account you are. An ID token lasts one hour, and the Firebase SDK renews it by itself. Every request from the website to the Atlas API carries the token in the header `Authorization: Bearer` followed by the token (`frontend/src/services/api.js`).

The API checks the token in `backend/src/middleware/auth.js` with `verifyIdToken` from `firebase-admin` (`backend/src/config/firebaseAdmin.js`). The check uses Google's public keys and only the Firebase project id, so tokens from any other Firebase project are refused, and no secret service-account key file is stored on the server. Your password never reaches the Atlas API or its database: Firebase keeps it.

The API also only accepts browser requests from the Atlas website's own address, except the Atlas Explorer chat (`POST /api/ask`), which needs no login. This rule is called CORS and is set by `FRONTEND_ORIGIN` in `backend/.env`.

## When does Atlas create my profile?

Atlas makes your profile row the first time the API sees a valid token from your account. `findOrCreateUser` in `backend/src/middleware/auth.js` looks you up by your Firebase user id and adds a row only when none exists. In practice this happens on `GET /api/me`, which the website calls on every page load and after every login (`frontend/src/context/AuthContext.jsx`).

A new profile's display name is chosen like this: the name on the token (a Google account's name); otherwise the part of the email before the @; cut to 50 characters; and "New member" if fewer than 2 characters are left. An email sign-up then replaces it with the display name typed on the form. If two first requests arrive at the same moment, the database's unique rule stops the second insert, and Atlas reads the row the first one made. Your email is copied from the token at that first visit and is not updated later.

## What do requireAuth, optionalAuth and requireAdmin do?

These three checks in `backend/src/middleware/auth.js` decide who may use each Atlas API route:

- `requireAuth`: for routes that need a logged-in user. No token gives 401 "Please log in to do that."; a bad or expired token gives 401 "Your session has expired. Please log in again." It guards everything under `/api/me`, `/api/saved` and `/api/admin`, and uploading, editing, deleting, upvoting, saving, recording a view and reporting.
- `optionalAuth`: for public routes: the feed, one study reviewer, and its file. A valid token adds the user, so the answer can say whether you upvoted or saved it and whether it is yours. A missing or bad token is treated as a visitor, so an expired login never blocks browsing.
- `requireAdmin`: runs after `requireAuth` on the `/api/admin` routes and gives 403 "Only admins can do that." to anyone whose role is not admin.

The owner check (only the uploader may edit or delete a study reviewer) and the upload limit check live in `backend/src/middleware/reviewerAccess.js`.

## What does Atlas store about me?

The Atlas database keeps one `users` row per person: an id number, the Firebase user id, your display name, your email, your role (member or admin) and the date you joined.

Linked to that row are the things you do on Atlas: your study reviewers (with their files on the server's disk, a fingerprint of each file, and the time you confirmed the rights), your upvotes, when you last opened each study reviewer (the Profile page shows the last 20), your saved items with their notes, your flashcards with their study status, and the reports you sent. Rate-limit counters are also kept for a short time: changes are counted per network address in 15-minute windows, and flashcard sets per account for 24 hours.

Atlas does not store your password or your Google picture: Firebase Authentication keeps your login, and the picture is loaded from Google. Your display name is public. Your email, saved list, notes and flashcards are shown only to you, and reporters are never named, not even to admins.

## What can an Atlas admin do?

An Atlas admin is an account whose `role` is `admin` in the `users` table; everyone else is `member`. Admins see a Reports link in the menu, which opens /admin. It lists every study reviewer with open reports, with each report's reason, details and date, but never the reporter's name. For each one, an admin can open the file and then choose:

- Restore: the reports were wrong; show it again.
- Fix category: move it to the right strand, grade, quarter, subject and material type, and show it again.
- Delete: remove it and its file for everyone.

Each choice closes its open reports, which are kept as a record. Admins, like the uploader, can still open a study reviewer that reports have hidden. Anyone else who opens /admin sees "Only admins can see this page.", and the API refuses them with 403.

## How is the first Atlas admin made?

Atlas has no admin sign-up and no button for making admins. The person first logs in once, so that their `users` row exists. Then someone with access to the database runs this SQL on the server:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

The new admin sees the Reports link after their next page load. Setting `role = 'member'` takes the admin rights away again. The database only allows the roles `member` and `admin` (the `users_role_check` rule in `backend/db/schema.sql`).

## How do I delete my Atlas account?

On the Profile page, "Delete my account" calls `DELETE /api/me` (`deleteMe` in `backend/src/controllers/meController.js`). The API first checks that you logged in within the last 5 minutes, using the token's `auth_time` (when you last typed your password or picked your Google account). Otherwise it answers 401 "For your safety, log in again, then delete your account within 5 minutes.", and the page offers "Log in again", which logs you out and returns you to the Profile page after you log in. This stops someone who finds a phone that was left logged in, and Firebase also asks for a recent login before it deletes a login.

Then Atlas deletes your `users` row, and `ON DELETE CASCADE` removes your study reviewers, upvotes, views, saved items, notes, flashcards and reports with it. Your uploaded files are deleted from the disk. Last, the browser deletes your Firebase login; if Firebase refuses, you are logged out instead, because your Atlas data is already gone. Other people who saved your study reviewers keep their saved titles and their own notes and flashcards. Deleting an Atlas account cannot be undone.

## Which Firebase Authentication settings does Atlas use?

Atlas uses the Firebase project `learnhub-ea4291`, and only its Authentication part:

- Sign-in providers: Email/Password and Google, both switched on in the Firebase console (Authentication, Sign-in method).
- Authorized domains: Firebase only allows sign-ins on web addresses that are on this list, so the live site's address, atlas-f2757.web.app, must be on it. If an address is missing, Google sign-in says "Google sign-in is not allowed on this web address yet." Local development uses the Auth emulator, which does not need this list.
- Plan: the free Spark plan is enough, because Atlas does not use Firestore or Firebase Storage. No billing account is needed.
- Web config: the website's Firebase values (API key, auth domain, project id and app id) come from the `VITE_FIREBASE_*` settings. They are public identifiers, not passwords.

The console settings themselves cannot be read from the code; this list follows the README and the code's error messages.

## Why does Google sign-in use learnhub-ea4291.firebaseapp.com?

The Google sign-in window runs on the "auth domain" set by `VITE_FIREBASE_AUTH_DOMAIN`. For the live Atlas site, `frontend/.env.production` sets it to `learnhub-ea4291.firebaseapp.com`, the Firebase project's own address. Google only accepts sign-ins that return to addresses listed on the project's Google OAuth client, and this address is listed. When the auth domain was switched to the new site's address after the rename, Google refused it with a `redirect_uri_mismatch` error, so pull request #7 (2026-10-23) moved it back. Because of this, Google's window can show the old LearnHub address, for example "to continue to learnhub-ea4291.firebaseapp.com". It is still the real Atlas sign-in.

## How do I use the Firebase Auth emulator for local development?

For local development, Atlas uses the Firebase Auth emulator: a stand-in for Firebase sign-in that runs on your own computer, so no real Firebase project or internet connection is needed.

- Start it from the project root with `firebase emulators:start --only auth`. It needs the Firebase CLI and Java 11 or newer.
- `firebase.json` runs it on 127.0.0.1, port 9099, and turns on the Emulator UI on port 4001, a local page that lists the test accounts.
- In `frontend/.env`, set `VITE_USE_AUTH_EMULATOR=true`; `frontend/src/firebase.js` then connects to the emulator.
- In `backend/.env`, set `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, so the API accepts emulator tokens. The project id `demo-atlas` works only with the emulator.

Emulator accounts live only in memory and vanish when the emulator stops; the matching `users` rows stay, which is harmless. Emulator tokens are not signed, so the API refuses to start when `FIREBASE_AUTH_EMULATOR_HOST` is set while `NODE_ENV=production`.

## What does Atlas not do with accounts?

Atlas keeps accounts simple. The complete list of what it does not do:

- It does not send a confirmation email after sign-up, so email addresses are not checked.
- It does not let you change your email or password while logged in; only the reset email changes a password.
- It offers no sign-in other than email and password or Google: no phone number, Facebook or GitHub.
- It has no two-step login.
- It does not let you upload a profile picture; only a Google account's picture is shown.
- It has no admin sign-up and no button for making admins.
- It cannot bring back a deleted account.
- It never stores passwords in its own database.
