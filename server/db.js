import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const DB_PATH = path.resolve('server', 'quiz_attempts.db')
let db

export function getDb() {
  if (db) return db
  db = new Database(DB_PATH)
  const schemaPath = path.resolve('server', 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db.exec(schema)
  migrateEdges(db)
  return db
}

function migrateEdges(dbInstance) {
  const columns = dbInstance.prepare('PRAGMA table_info(edges)').all()
  if (!columns.length) return
  const columnNames = columns.map((col) => col.name)
  const isLegacy = columnNames.includes('fromTopicId')
  if (!isLegacy) return

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS edges_v2 (
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
  `)

  dbInstance.exec(`
    INSERT INTO edges_v2 (id, fromId, fromType, toId, toType, weight, reason, createdAt, updatedAt, isArchived)
    SELECT id, fromTopicId, 'topic', toTopicId, 'topic', weight, reason, createdAt, updatedAt, isArchived
    FROM edges;
  `)

  dbInstance.exec('DROP TABLE edges;')
  dbInstance.exec('ALTER TABLE edges_v2 RENAME TO edges;')
  dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(fromId, fromType);')
  dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(toId, toType);')
}
