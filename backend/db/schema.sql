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

-- Indexes speed up the lookups the app does most often.
CREATE INDEX IF NOT EXISTS idx_reviewers_created_at ON reviewers (created_at);
CREATE INDEX IF NOT EXISTS idx_reviewers_subject ON reviewers (subject);
CREATE INDEX IF NOT EXISTS idx_reviewers_author_id ON reviewers (author_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_reviewer_id ON upvotes (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed (user_id);
