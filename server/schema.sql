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

-- Cognitive Fingerprint tables
CREATE TABLE IF NOT EXISTS cognitive_events (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  sessionId TEXT,
  courseId TEXT,
  conceptTags TEXT NOT NULL,
  questionId TEXT,
  interactionType TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fingerprint_user (
  userId TEXT PRIMARY KEY,
  errorTypeScores TEXT NOT NULL,
  preferenceScores TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fingerprint_concept (
  userId TEXT NOT NULL,
  conceptTag TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.3,
  fragility REAL NOT NULL DEFAULT 0.3,
  halfLifeDays REAL NOT NULL DEFAULT 5,
  lastSeenAt TEXT,
  lastPracticedAt TEXT,
  exposures INTEGER NOT NULL DEFAULT 0,
  successCount INTEGER NOT NULL DEFAULT 0,
  failCount INTEGER NOT NULL DEFAULT 0,
  lastFailModes TEXT NOT NULL DEFAULT '[]',
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, conceptTag)
);

CREATE TABLE IF NOT EXISTS user_settings (
  userId TEXT PRIMARY KEY,
  enableFingerprint INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cognitive_events_user ON cognitive_events(userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_cognitive_events_tags ON cognitive_events(conceptTags);
CREATE INDEX IF NOT EXISTS idx_fingerprint_concept_user ON fingerprint_concept(userId);
