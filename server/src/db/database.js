import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbType = (config.databaseType || 'sqlite').toLowerCase();
let sqliteDb = null;
let pgPool = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createPrepared(sql) {
  if (dbType === 'postgres') {
    const pgSql = toPgSql(sql);
    return {
      async get(...params) {
        const result = await pgPool.query(pgSql, params);
        return result.rows[0] || null;
      },
      async all(...params) {
        const result = await pgPool.query(pgSql, params);
        return result.rows;
      },
      async run(...params) {
        const result = await pgPool.query(pgSql, params);
        return { rowCount: result.rowCount, rows: result.rows };
      }
    };
  }

  const stmt = sqliteDb.prepare(sql);
  return {
    get(...params) {
      return stmt.get(...params);
    },
    all(...params) {
      return stmt.all(...params);
    },
    run(...params) {
      return stmt.run(...params);
    }
  };
}

export const db = {
  prepare(sql) {
    return createPrepared(sql);
  },
  async exec(sql) {
    if (dbType === 'postgres') {
      await pgPool.query(sql);
      return;
    }
    sqliteDb.exec(sql);
  },
  async transaction(fn) {
    if (dbType === 'postgres') {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          prepare(sql) {
            const pgSql = toPgSql(sql);
            return {
              async get(...params) {
                const result = await client.query(pgSql, params);
                return result.rows[0] || null;
              },
              async all(...params) {
                const result = await client.query(pgSql, params);
                return result.rows;
              },
              async run(...params) {
                const result = await client.query(pgSql, params);
                return { rowCount: result.rowCount, rows: result.rows };
              }
            };
          }
        };
        const result = await fn(txDb);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    sqliteDb.exec('BEGIN');
    try {
      const result = await fn(db);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
  }
};

function initSQLite() {
  const dbDir = path.dirname(config.dbPath);
  ensureDir(dbDir);
  sqliteDb = new DatabaseSync(config.dbPath);
}

function initPostgres() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required when DATABASE_TYPE=postgres');
  }

  pgPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl === 'true' ? { rejectUnauthorized: false } : undefined
  });
}

async function createSchemaSQLite() {
  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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
      fingerprint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES migration_jobs(id)
    );
  `);

  try {
    await db.exec('ALTER TABLE migration_items ADD COLUMN fingerprint TEXT;');
    console.log('[SQLite] Added fingerprint column to migration_items');
  } catch {}

  await db.exec(`
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

async function createSchemaPostgres() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      scopes TEXT NOT NULL,
      token_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_items (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES migration_jobs(id),
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
      fingerprint TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      job_id TEXT,
      item_id TEXT,
      level TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`ALTER TABLE migration_items ADD COLUMN IF NOT EXISTS fingerprint TEXT;`);
  console.log('[PostgreSQL] Migration schema initialized successfully');
}

export async function initDatabase() {
  if (dbType === 'postgres') {
    initPostgres();
    await createSchemaPostgres();
    return;
  }

  initSQLite();
  await createSchemaSQLite();
}

export function getDatabaseBackend() {
  return dbType === 'postgres' ? 'postgresql' : 'sqlite';
}

export async function closeDatabase() {
  if (dbType === 'postgres') {
    if (pgPool) {
      await pgPool.end();
      pgPool = null;
    }
    return;
  }

  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
