CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  createdAt TEXT,
  topic TEXT,
  quiz TEXT,
  responses TEXT,
  result TEXT
);
