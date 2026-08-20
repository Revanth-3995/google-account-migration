import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(config.dbPath);

export function initDatabase() {
  // 1. Accounts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      scopes TEXT NOT NULL,
      token_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Migration Jobs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_jobs (
      id TEXT PRIMARY KEY,
      service_type TEXT NOT NULL,
      migration_mode TEXT NOT NULL,
      source_email TEXT NOT NULL,
      dest_email TEXT NOT NULL,
      status TEXT NOT NULL,
      total_items INTEGER DEFAULT 0,
      completed_items INTEGER DEFAULT 0,
      failed_items INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME
    );
  `);

  // 3. Migration Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_items (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      source_item_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      item_type TEXT NOT NULL,
      parent_path TEXT,
      source_parent_id TEXT,
      dest_parent_id TEXT,
      dest_item_id TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES migration_jobs(id)
    );
  `);

  try {
    db.exec('ALTER TABLE migration_items ADD COLUMN fingerprint TEXT;');
    console.log('[SQLite] Added fingerprint column to migration_items');
  } catch (e) {
    // Ignore if column already exists
  }

  // 4. Audit Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      item_id TEXT,
      level TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[SQLite] Migration database schema initialized at:', config.dbPath);
}

