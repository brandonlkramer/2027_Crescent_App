-- Vocab quiz backend schema (Cloudflare D1 / SQLite)
-- No table stores names, emails, student numbers or the roster mapping.

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,      -- sentence item ID from the bank, e.g. sign-n-notice-1
  week        INTEGER NOT NULL,
  headword    TEXT NOT NULL,         -- lemma (one per quiz)
  sense_id    TEXT NOT NULL,
  sentence    TEXT NOT NULL,         -- contains a single ___
  answer      TEXT NOT NULL,
  form        TEXT,
  cue         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_week ON items(week, headword);

-- Valid four-word identifiers (labels only; the name mapping stays on the administrator's computer)
CREATE TABLE IF NOT EXISTS identifiers (
  identifier  TEXT PRIMARY KEY,      -- word-word-word-word
  class_label TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  label       TEXT,
  week        INTEGER NOT NULL,
  n_items     INTEGER NOT NULL,
  new_ratio   REAL NOT NULL,
  keyboard    TEXT NOT NULL CHECK (keyboard IN ('restricted','full')),
  seconds     INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at  INTEGER NOT NULL,
  closed_at   INTEGER
);

CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  identifier   TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  items_json   TEXT NOT NULL,        -- ordered item IDs for this student's quiz
  started_at   INTEGER NOT NULL,
  submitted_at INTEGER,
  score        INTEGER,
  UNIQUE (session_id, identifier)
);

CREATE TABLE IF NOT EXISTS responses (
  attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  item_id     TEXT NOT NULL,
  headword    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  typed       TEXT,
  correct     INTEGER NOT NULL,
  ms          INTEGER,
  PRIMARY KEY (attempt_id, position)
);
