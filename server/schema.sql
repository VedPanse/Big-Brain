CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  createdAt TEXT,
  topic TEXT,
  quiz TEXT,
  responses TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topic_stats (
  topicId TEXT PRIMARY KEY REFERENCES topics(id),
  strength REAL NOT NULL DEFAULT 0.3,
  lastSeenAt TEXT,
  lastReviewedAt TEXT,
  nextReviewAt TEXT,
  exposures INTEGER NOT NULL DEFAULT 0,
  correctCount INTEGER NOT NULL DEFAULT 0,
  incorrectCount INTEGER NOT NULL DEFAULT 0,
  skipCount INTEGER NOT NULL DEFAULT 0,
  minutesSpent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  topicId TEXT NOT NULL REFERENCES topics(id),
  label TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS concept_stats (
  conceptId TEXT PRIMARY KEY REFERENCES concepts(id),
  strength REAL NOT NULL DEFAULT 0.25,
  lastSeenAt TEXT,
  lastReviewedAt TEXT,
  nextReviewAt TEXT,
  exposures INTEGER NOT NULL DEFAULT 0,
  correctCount INTEGER NOT NULL DEFAULT 0,
  incorrectCount INTEGER NOT NULL DEFAULT 0,
  skipCount INTEGER NOT NULL DEFAULT 0,
  minutesSpent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  fromId TEXT NOT NULL,
  fromType TEXT NOT NULL CHECK(fromType IN ('topic','concept')),
  toId TEXT NOT NULL,
  toType TEXT NOT NULL CHECK(toType IN ('topic','concept')),
  weight REAL NOT NULL DEFAULT 0.3,
  reason TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0,
  UNIQUE(fromId, fromType, toId, toType)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(fromId, fromType);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(toId, toType);
CREATE INDEX IF NOT EXISTS idx_topic_stats_review ON topic_stats(nextReviewAt);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(createdAt);
