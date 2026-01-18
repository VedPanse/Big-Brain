CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  createdAt TEXT,
  topic TEXT,
  quiz TEXT,
  responses TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT,
  slug TEXT
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  label TEXT
);

CREATE TABLE IF NOT EXISTS course_concepts (
  course_id TEXT,
  concept_id TEXT,
  importance REAL,
  PRIMARY KEY (course_id, concept_id)
);

CREATE TABLE IF NOT EXISTS quiz_items (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  prompt TEXT,
  choices_json TEXT,
  answer_json TEXT,
  difficulty REAL DEFAULT 0.5,
  primary_concept_id TEXT,
  secondary_concept_ids_json TEXT,
  tags_json TEXT,
  is_transfer INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT,
  ts TEXT,
  user_id TEXT,
  course_id TEXT,
  concept_id TEXT,
  correct INTEGER,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS learner_concept_state (
  user_id TEXT,
  concept_id TEXT,
  mastery_score REAL DEFAULT 0.4,
  fragility_score REAL DEFAULT 0.5,
  confidence_score REAL DEFAULT 0.5,
  prereq_gap_score REAL DEFAULT 0,
  attempt_count_total INTEGER DEFAULT 0,
  streak_success INTEGER DEFAULT 0,
  streak_fail INTEGER DEFAULT 0,
  last_practiced_at TEXT,
  next_review_at TEXT,
  PRIMARY KEY (user_id, concept_id)
);
