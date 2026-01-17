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
  return db
}
