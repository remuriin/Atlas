-- Atlas database schema.
-- Every statement uses IF NOT EXISTS, so this file is safe to run again and again.

-- One row per person. Passwords are NOT stored here: Firebase Authentication owns them.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- A study reviewer: the details people see plus information about the uploaded file.
CREATE TABLE IF NOT EXISTS reviewers (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  subject TEXT NOT NULL,
  tags TEXT,
  file_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
  CHECK (char_length(description) >= 10 AND char_length(description) <= 2000)
);

-- One row per upvote. The two-column primary key means the database itself
-- refuses a second upvote from the same user on the same reviewer.
CREATE TABLE IF NOT EXISTS upvotes (
  reviewer_id INTEGER REFERENCES reviewers(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (reviewer_id, user_id)
);

-- Remembers when a user last opened a reviewer (one row per user and reviewer).
CREATE TABLE IF NOT EXISTS recently_viewed (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES reviewers(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, reviewer_id)
);

-- One row per study reviewer a user saved. The user's notes for it live here too.
-- If the uploader deletes the original, reviewer_id becomes NULL but the row stays,
-- so the saved title, subject, notes, and flashcards are not lost.
CREATE TABLE IF NOT EXISTS saved_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES reviewers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  notes_updated_at TIMESTAMP,
  saved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, reviewer_id),
  -- Notes are stored as simple formatted HTML: 20,000 visible characters plus markup.
  CONSTRAINT saved_items_notes_size CHECK (char_length(notes) <= 100000)
);

-- Changes for databases made before notes could be formatted. Each one is safe to repeat.
-- 'text' = old plain-text notes, 'html' = formatted notes (every save from now on).
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS notes_format TEXT NOT NULL DEFAULT 'text';
-- The old 20,000-character limit counted the markup too, so it is replaced by the one above.
ALTER TABLE saved_items DROP CONSTRAINT IF EXISTS saved_items_notes_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_items_notes_size') THEN
    ALTER TABLE saved_items ADD CONSTRAINT saved_items_notes_size CHECK (char_length(notes) <= 100000);
  END IF;
END $$;

-- Flashcards made from a saved item. Deleting the saved item deletes its cards.
CREATE TABLE IF NOT EXISTS flashcards (
  id SERIAL PRIMARY KEY,
  saved_item_id INTEGER NOT NULL REFERENCES saved_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('new', 'learning', 'learned'))
);

-- Senior High School categories: strand, grade, quarter, and material type.
-- The allowed values live in backend/src/utils/categories.js. Each step is safe to repeat.
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS strand TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS material_type TEXT;
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS strand TEXT;

-- Reviewers made before the categories existed: their old subject (such as "Mathematics")
-- is not a Senior High School subject, so it moves into the tags and the subject becomes
-- "Other". Only rows without a strand are touched, so this runs once per row.
UPDATE reviewers
SET tags = CASE
      WHEN tags IS NULL OR tags = '' THEN lower(subject)
      WHEN (',' || tags || ',') LIKE ('%,' || lower(subject) || ',%') THEN tags
      ELSE lower(subject) || ',' || tags
    END,
    subject = 'Other',
    strand = 'All strands',
    grade = '11',
    quarter = '1st',
    material_type = 'Reviewer'
WHERE strand IS NULL;

-- Saved copies follow their reviewer. A copy whose original was deleted keeps its old
-- subject as plain text and gets the "All strands" color.
UPDATE saved_items s
SET strand = COALESCE((SELECT r.strand FROM reviewers r WHERE r.id = s.reviewer_id), 'All strands'),
    subject = COALESCE((SELECT r.subject FROM reviewers r WHERE r.id = s.reviewer_id), s.subject)
WHERE s.strand IS NULL;

ALTER TABLE reviewers ALTER COLUMN strand SET NOT NULL;
ALTER TABLE reviewers ALTER COLUMN grade SET NOT NULL;
ALTER TABLE reviewers ALTER COLUMN quarter SET NOT NULL;
ALTER TABLE reviewers ALTER COLUMN material_type SET NOT NULL;
ALTER TABLE saved_items ALTER COLUMN strand SET NOT NULL;

-- Reports and admins. 'member' is everyone; 'admin' can review reported study reviewers.
-- The first admin is set by hand: UPDATE users SET role = 'admin' WHERE email = '...';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'admin'));
  END IF;
END $$;

-- A reviewer reported by enough people is hidden from everyone but its uploader and
-- the admins, until an admin restores, fixes, or deletes it.
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- One row per report. resolved_at is set when an admin deals with the reviewer;
-- resolved reports are kept as a record. The allowed reasons live in backend/src/utils/validate.js.
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reviewer_id INTEGER NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  CHECK (char_length(details) <= 500)
);

-- When the uploader last confirmed "I made this, or I have the right to share it" for the
-- current file. Empty for files uploaded before the confirmation was asked for.
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS rights_confirmed_at TIMESTAMP;

-- The SHA-256 fingerprint of the current file. Two identical files have the same one,
-- so the same file cannot be posted twice. Empty for files uploaded before this existed.
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Indexes speed up the lookups the app does most often.
CREATE INDEX IF NOT EXISTS idx_reviewers_created_at ON reviewers (created_at);
CREATE INDEX IF NOT EXISTS idx_reviewers_subject ON reviewers (subject);
CREATE INDEX IF NOT EXISTS idx_reviewers_strand ON reviewers (strand);
CREATE INDEX IF NOT EXISTS idx_reviewers_grade ON reviewers (grade);
CREATE INDEX IF NOT EXISTS idx_reviewers_author_id ON reviewers (author_id);
-- The database itself refuses a second reviewer with the same file, even when two
-- uploads of it arrive at the same moment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewers_file_hash
  ON reviewers (file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upvotes_reviewer_id ON upvotes (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_saved_item_id ON flashcards (saved_item_id);
CREATE INDEX IF NOT EXISTS idx_reports_reviewer_id ON reports (reviewer_id);
-- A person can have only one open report per reviewer (they may report again after
-- an admin has dealt with the first one).
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_open_per_user
  ON reports (reviewer_id, user_id) WHERE resolved_at IS NULL;
