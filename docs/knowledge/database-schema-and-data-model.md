# Atlas database schema and data model

Atlas keeps its data in one PostgreSQL database (named `learnhub` on the live server) with eight tables, all defined in `backend/db/schema.sql`. This page describes every table, column, constraint and index, how the tables point at each other, what the database does when rows are deleted, and which rules are checked by the API instead of the database. Passwords are never stored in it: Firebase Authentication owns logins. Uploaded files are not stored in it either: they live on disk.

## What tables does the Atlas database have and how are they related?

The Atlas database has eight tables. In plain words:

- `users`: one row per person who has logged in, linked to their Firebase account.
- `reviewers`: the study reviewers. Each one is owned by one user (its uploader) and names one file on disk.
- `upvotes`: links a user to a reviewer they upvoted.
- `recently_viewed`: links a user to a reviewer they opened, with the time.
- `saved_items`: a user's own copy of a reviewer for studying, holding that user's notes. It keeps the title even if the original is deleted.
- `flashcards`: cards that belong to one saved item.
- `reports`: a user's report about someone else's reviewer.
- `rate_limits`: counters for request limits. It stands alone, with no links to the other tables.

Every link is a foreign key: an INTEGER column that holds the `id` of a row in another table, such as `reviewers.author_id` pointing at `users.id`. The `id` columns are SERIAL, which means PostgreSQL numbers new rows itself. In the code and the database a study reviewer is called a "reviewer". A study reviewer is always two things: a row in `reviewers` and a file in the uploads folder (`UPLOAD_DIR`), named by the row's `stored_name`.

## What does the users table store?

The `users` table has one row per person:

| Column | Type and rules |
| --- | --- |
| `id` | SERIAL primary key |
| `firebase_uid` | TEXT, NOT NULL, UNIQUE: the Firebase Authentication user id |
| `display_name` | TEXT, NOT NULL |
| `email` | TEXT, NOT NULL, not unique |
| `created_at` | TIMESTAMP, default NOW() |
| `role` | TEXT, NOT NULL, default `'member'`, check `users_role_check`: `'member'` or `'admin'` |

The API creates the row the first time a logged-in person calls it (find-or-create in `backend/src/middleware/auth.js`). The first display name is the Firebase account name, else the part of the email before the @, cut to 50 characters, or "New member" when that is shorter than 2 characters. The API keeps display names between 2 and 50 characters; the users table itself has no length rule. The email can appear in two rows, for example when an emulator account is created again after the emulator restarts. There is no admin sign-up: an admin is made by hand with `UPDATE users SET role = 'admin' WHERE email = '...';`. The six sample students (`seed-user-1` to `seed-user-6`) have no Firebase account, so nobody can log in as them.

## What does the reviewers table store?

The `reviewers` table holds one row per study reviewer. Its content, category and moderation columns:

| Column | Type and rules |
| --- | --- |
| `id` | SERIAL primary key |
| `author_id` | INTEGER, NOT NULL, references `users(id)` ON DELETE CASCADE: the uploader |
| `title` | TEXT, NOT NULL, check: 3 to 120 characters |
| `description` | TEXT, NOT NULL, check: 10 to 2000 characters |
| `strand` | TEXT, NOT NULL, for example `'STEM'` or `'All strands'` |
| `grade` | TEXT, NOT NULL: `'11'` or `'12'` |
| `quarter` | TEXT, NOT NULL: `'1st'` to `'4th'` |
| `subject` | TEXT, NOT NULL |
| `material_type` | TEXT, NOT NULL, for example `'Reviewer'` |
| `tags` | TEXT, may be NULL: lowercase tags joined by commas |
| `is_hidden` | BOOLEAN, NOT NULL, default false |

The allowed strands, grades, quarters, subjects and material types live in `backend/src/utils/categories.js`; the reviewers table does not check them. Tags are stored as one string such as `rocks,rock cycle,geology`, and the API allows at most 8 tags of up to 30 characters each. `is_hidden` becomes true when a reviewer has 3 open reports from different people; it then leaves the feed and Recently viewed, and answers 404 to everyone except its uploader and admins until an admin restores, fixes or deletes it. The file columns and indexes are in [How does the reviewers table describe the uploaded file?](database-schema-and-data-model.md#how-does-the-reviewers-table-describe-the-uploaded-file).

## How does the reviewers table describe the uploaded file?

The reviewers table also describes each study reviewer's file and its dates:

| Column | Type and meaning |
| --- | --- |
| `file_name` | TEXT, NOT NULL: the uploader's own file name, cleaned and cut to 200 characters, shown on the page and used as the download name |
| `stored_name` | TEXT, NOT NULL: the name on disk in `UPLOAD_DIR`, 32 random hex characters plus the extension |
| `file_mime` | TEXT, NOT NULL: the content type from the API's allowlist, not the browser's claim |
| `file_size` | INTEGER, NOT NULL: size in bytes |
| `file_hash` | TEXT, may be NULL: SHA-256 fingerprint of the file |
| `rights_confirmed_at` | TIMESTAMP, may be NULL: when the uploader confirmed "I made this file, or I have the right to share it" |
| `created_at` | TIMESTAMP, default NOW() |
| `updated_at` | TIMESTAMP, default NOW(): set again when the uploader edits, not when an admin fixes the category |

Indexes on the reviewers table: `idx_reviewers_created_at`, `idx_reviewers_subject`, `idx_reviewers_strand`, `idx_reviewers_grade`, `idx_reviewers_author_id`, and the unique partial index `idx_reviewers_file_hash` on `file_hash` WHERE `file_hash IS NOT NULL`. That unique index refuses a second reviewer with the same file, even when two uploads arrive at the same moment. Files from before fingerprints existed have NULL there, so copies of them are not caught. The sample PDFs keep readable stored names such as `seed-rock-cycle.pdf`.

## What does the upvotes table store?

The `upvotes` table has one row per upvote:

| Column | Type and rules |
| --- | --- |
| `reviewer_id` | INTEGER, references `reviewers(id)` ON DELETE CASCADE |
| `user_id` | INTEGER, references `users(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMP, default NOW() |

The primary key is the pair (`reviewer_id`, `user_id`), so the database itself refuses a second upvote from the same user on the same reviewer, and both columns are NOT NULL because they form the primary key. The extra index `idx_upvotes_reviewer_id` speeds up counting. Adding an upvote (`PUT /api/reviewers/:id/upvote`) and removing one (`DELETE`) are both safe to repeat: when a double click sends two requests, the API ignores the duplicate that the primary key refuses. Upvotes are the only social feature of Atlas. The upvotes table stores no totals; see [Why are upvote counts never stored?](database-schema-and-data-model.md#why-are-upvote-counts-never-stored).

## What does the recently_viewed table store?

The `recently_viewed` table remembers when a logged-in user last opened a reviewer:

| Column | Type and rules |
| --- | --- |
| `user_id` | INTEGER, references `users(id)` ON DELETE CASCADE |
| `reviewer_id` | INTEGER, references `reviewers(id)` ON DELETE CASCADE |
| `viewed_at` | TIMESTAMP, default NOW() |

The primary key is the pair (`user_id`, `reviewer_id`), so there is one row per user and reviewer. Opening the same reviewer again moves `viewed_at` to now instead of adding a row (`POST /api/reviewers/:id/view`). The index `idx_recently_viewed_user_id` speeds up each user's list. The Recently viewed list on the Profile page shows the newest 20 rows and leaves out reviewers hidden by reports. Visitors who are not logged in leave no rows. Old rows in recently_viewed are never cleaned up on a schedule: they go only when the user or the reviewer is deleted, or when the database is reset with the seed script.

## What does the saved_items table store?

The `saved_items` table holds a user's saved study reviewers and their notes:

| Column | Type and rules |
| --- | --- |
| `id` | SERIAL primary key |
| `user_id` | INTEGER, NOT NULL, references `users(id)` ON DELETE CASCADE |
| `reviewer_id` | INTEGER, may be NULL, references `reviewers(id)` ON DELETE SET NULL |
| `title`, `subject`, `strand` | TEXT, NOT NULL: copies of the reviewer's values |
| `notes` | TEXT, NOT NULL, default `''` |
| `notes_format` | TEXT, NOT NULL, default `'text'` |
| `notes_updated_at` | TIMESTAMP, may be NULL |
| `saved_at` | TIMESTAMP, default NOW() |

Rules: UNIQUE (`user_id`, `reviewer_id`), so saving twice keeps one row, and the check `saved_items_notes_size` allows at most 100,000 characters of notes including the formatting markup. The API also limits the visible text to 20,000 characters and allows only a short list of HTML tags. `notes_format` is `'text'` for old plain notes and `'html'` for every save since formatting arrived. The copies of title, subject and strand are refreshed when the uploader edits or an admin moves the reviewer. When the original is deleted, `reviewer_id` becomes NULL and the row, notes and flashcards stay. NULL never equals NULL in a UNIQUE rule, so one user may keep several such rows. Index: `idx_saved_items_user_id`.

## What does the flashcards table store?

The `flashcards` table holds the AI flashcards of each saved item:

| Column | Type and rules |
| --- | --- |
| `id` | SERIAL primary key |
| `saved_item_id` | INTEGER, NOT NULL, references `saved_items(id)` ON DELETE CASCADE |
| `position` | INTEGER, NOT NULL: order in the set, starting at 1 |
| `front` | TEXT, NOT NULL: the question or term |
| `back` | TEXT, NOT NULL: the answer |
| `status` | TEXT, NOT NULL, default `'new'`, check: `'new'`, `'learning'` or `'learned'` |
| `created_at` | TIMESTAMP, default NOW() |

The index `idx_flashcards_saved_item_id` speeds up loading a set. Flashcards belong to a saved item, not to the reviewer, so each person's cards and progress are private. Google Gemini writes them on the server; the API asks for 5 to 100 cards and cuts each front to 200 and each back to 600 characters. A new set replaces the old one inside one transaction (delete, then insert), so if anything fails the old cards stay. The buttons "Still learning" and "Got it" set `status` to `'learning'` and `'learned'`. The flashcards table itself has no limit on how many cards one saved item has.

## What does the reports table store?

The `reports` table has one row per report about a study reviewer:

| Column | Type and rules |
| --- | --- |
| `id` | SERIAL primary key |
| `reviewer_id` | INTEGER, NOT NULL, references `reviewers(id)` ON DELETE CASCADE |
| `user_id` | INTEGER, NOT NULL, references `users(id)` ON DELETE CASCADE: the reporter |
| `reason` | TEXT, NOT NULL |
| `details` | TEXT, NOT NULL, default `''`, check: at most 500 characters |
| `created_at` | TIMESTAMP, default NOW() |
| `resolved_at` | TIMESTAMP, may be NULL: NULL means the report is still open |

Indexes: `idx_reports_reviewer_id`, and the unique partial index `idx_reports_one_open_per_user` on (`reviewer_id`, `user_id`) WHERE `resolved_at IS NULL`, so a person has at most one open report per reviewer and may report again after an admin has dealt with it. The reasons (Offensive, Spam, Irrelevant, Wrong category, Copyright) are checked by `backend/src/utils/validate.js`, not by the reports table. The third open report hides the reviewer. An admin's Restore or Fix category sets `resolved_at` and keeps the rows as a record. Deleting the reviewer, by its uploader or an admin, deletes its reports too (ON DELETE CASCADE). Reporters are never shown, not even to admins.

## What does the rate_limits table store?

The `rate_limits` table keeps the request counters that must survive an API restart:

| Column | Type and rules |
| --- | --- |
| `key` | TEXT, primary key: which limit, and who |
| `hits` | INTEGER, NOT NULL: requests counted in the current window |
| `reset_at` | TIMESTAMPTZ, NOT NULL: when the window ends |

Two limits use the rate_limits table (`backend/src/utils/rateLimitStore.js`): the write limit, 120 changes per 15 minutes per visitor, with keys that start with `write:` followed by the visitor's IP address, and the flashcard limit, 10 sets per account per 24 hours, with keys like `flashcards:user-42`. The table has no foreign keys, so deleting an account leaves its counter until it expires. Each API process deletes rows whose `reset_at` has passed once an hour, and an ended window restarts at 1 on the next request anyway. The general limit and the study-save limit (600 requests per 15 minutes each) are counted in memory, not in this table. If the database cannot be reached, the two limits in rate_limits let requests through instead of failing them.

## What happens when a user, reviewer or saved item is deleted?

The foreign keys in `backend/db/schema.sql` decide what goes with a deleted row:

- Deleting a user ("Delete my account") removes everything the user owns: their reviewers, upvotes, recently viewed rows, saved items with notes, the flashcards of those saved items, and the reports they made. Their reviewers take their own upvotes, views and reports with them. Other people's saved copies of those reviewers stay, with `reviewer_id` set to NULL.
- Deleting a reviewer removes its upvotes, recently viewed rows and reports, and sets `saved_items.reviewer_id` to NULL. People who saved it keep the copied title, subject and strand, their notes and their flashcards; only the file is gone, and new flashcards cannot be made from it.
- Deleting a saved item (removing it from Saved) removes its flashcards.
- Deleting a flashcard, upvote, view or report removes nothing else, and `rate_limits` rows are never touched by a deletion.

Files are not in the database, so the API removes them itself: it deletes a reviewer's row first and its file second. For an account it first reads the `stored_name` of every reviewer the user owns, deletes the user, then deletes those files; the browser then deletes the Firebase login. Deleting an account needs a login from the last 5 minutes.

## Why are upvote counts never stored?

Atlas never stores an upvote total in the reviewers table. Every read counts the rows of the upvotes table instead: the feed, a single reviewer and a user's uploads use `COUNT(up.user_id)` with a LEFT JOIN in `backend/src/models/reviewersModel.js`, which gives 0 for a reviewer without upvotes; the Saved list uses a `COUNT(*)` subquery in `backend/src/models/savedItemsModel.js`; and after an upvote is added or removed the API returns a fresh `COUNT(*)` from `backend/src/models/upvotesModel.js`. A stored counter can drift out of step, for example when two requests arrive together or a deletion cascades; a count of the real rows cannot. The cost is counting on every read, which the index `idx_upvotes_reviewer_id` keeps quick at Atlas's size. Without a search, the Top tab sorts by this counted total and then by newest. node-postgres returns COUNT as a string, so the API turns it into a number.

## Why do most tables use TIMESTAMP but rate_limits uses TIMESTAMPTZ?

Every date column in Atlas except one is `TIMESTAMP` (without time zone), filled by `DEFAULT NOW()` or by `NOW()` in the API's SQL: `created_at` in users, reviewers, upvotes, flashcards and reports, plus `updated_at`, `rights_confirmed_at`, `viewed_at`, `saved_at`, `notes_updated_at` and `resolved_at`. Such a value is a plain wall-clock time in the database's time zone setting, normally the server's local time, with no zone stored next to it. The API reads it back as a time in its own local zone, so the times come out right when the API and the database use the same time zone. If times look shifted by a few hours in local development, the local database and the API are in different time zones. `rate_limits.reset_at` is `TIMESTAMPTZ` (with time zone) because the API compares it with its own clock to decide when a limit window ends. TIMESTAMPTZ stores an exact moment, so that comparison is right whatever time zone each side uses.

## What data migrations does schema.sql run?

Besides creating tables, `backend/db/schema.sql` updates databases made by older versions of Atlas. Every step is safe to repeat:

1. Adds `saved_items.notes_format` with default `'text'`, so notes written before formatting stay plain text; every save since writes `'html'`.
2. Drops the old notes rule `saved_items_notes_check` (20,000 characters, counting the markup too) and adds `saved_items_notes_size` (100,000 characters) inside a DO block that first looks in `pg_constraint`.
3. Adds `strand`, `grade`, `quarter` and `material_type` to reviewers, and `strand` to saved_items.
4. Reviewers without a strand get their old subject (such as "Mathematics") added to their tags in lowercase, unless it is there already, and are set to subject "Other", strand "All strands", grade "11", quarter "1st" and material type "Reviewer".
5. Saved items without a strand copy the strand and subject of their reviewer, or get "All strands" and keep their own subject when the original is gone.
6. Makes those five new columns NOT NULL.
7. Adds `users.role` (default `'member'`) and its check `users_role_check`, again inside a DO block.
8. Adds `reviewers.is_hidden`, creates `reports`, adds `rights_confirmed_at` and `file_hash` to reviewers, creates `rate_limits`, and creates the indexes.

The UPDATE steps only touch rows whose strand is still NULL, so each row is changed once, and on a new, empty database they change nothing. A moved reviewer that already had 8 tags then has 9 and must drop one before it can be saved again.

## Which rules does the Atlas API check instead of the database?

Some Atlas rules live only in the API code, not in `backend/db/schema.sql`:

- the allowed strands, grades, quarters, subjects and material types (`backend/src/utils/categories.js`, kept the same as `frontend/src/services/categories.js`);
- the report reasons, at most 8 tags of up to 30 characters, display names of 2 to 50 characters, notes of up to 20,000 visible characters with only the allowed tags, and 5 to 100 flashcards per request (`backend/src/utils/validate.js`);
- the upload limit of 50 reviewers per person (`MAX_UPLOADS_PER_USER`), the file type and content checks, and the virus scan;
- who may do what: only the uploader edits or deletes a reviewer, only admins see the Reports page, and people cannot report their own reviewer.

SQL typed by hand, for example in psql, is not stopped by any of these rules, so data changed by hand must follow them too. The database itself enforces the NOT NULL columns, the CHECK rules on title, description, notes size, report details, role and flashcard status, the UNIQUE rules, the primary keys and the foreign keys with their ON DELETE actions.
