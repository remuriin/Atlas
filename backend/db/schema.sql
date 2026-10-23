-- LearnHub database schema.
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

-- Indexes speed up the lookups the app does most often.
CREATE INDEX IF NOT EXISTS idx_reviewers_created_at ON reviewers (created_at);
CREATE INDEX IF NOT EXISTS idx_reviewers_subject ON reviewers (subject);
CREATE INDEX IF NOT EXISTS idx_reviewers_author_id ON reviewers (author_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_reviewer_id ON upvotes (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_saved_item_id ON flashcards (saved_item_id);
