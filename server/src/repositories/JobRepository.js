import { db } from '../db/database.js';

export class JobRepository {
  static async create(ownerSessionId, { id, serviceType, migrationMode, sourceEmail, destEmail, status, totalItems }) {
    const stmt = db.prepare(`
      INSERT INTO migration_jobs (
        id, owner_session_id, service_type, migration_mode, source_email, dest_email, status, total_items, completed_items, failed_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);
    return await stmt.run(id, ownerSessionId, serviceType, migrationMode, sourceEmail, destEmail, status || 'READY', totalItems || 0);
  }

  static async get(ownerSessionId, id) {
    const stmt = db.prepare('SELECT * FROM migration_jobs WHERE owner_session_id = ? AND id = ?');
    return await stmt.get(ownerSessionId, id);
  }

  static async getAll(ownerSessionId) {
    const stmt = db.prepare('SELECT * FROM migration_jobs WHERE owner_session_id = ? ORDER BY created_at DESC');
    return await stmt.all(ownerSessionId);
  }

  static async updateStatus(ownerSessionId, id, status, extra = {}) {
    let sql = 'UPDATE migration_jobs SET status = ?';
    const params = [status];

    if (status === 'RUNNING') {
      sql += ', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)';
    } else if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      sql += ', completed_at = CURRENT_TIMESTAMP';
    }

    if (extra.completed_items !== undefined) {
      sql += ', completed_items = ?';
      params.push(extra.completed_items);
    }
    if (extra.failed_items !== undefined) {
      sql += ', failed_items = ?';
      params.push(extra.failed_items);
    }

    sql += ' WHERE owner_session_id = ? AND id = ?';
    params.push(ownerSessionId);
    params.push(id);

    const stmt = db.prepare(sql);
    return await stmt.run(...params);
  }

  static async incrementCompleted(ownerSessionId, id) {
    const stmt = db.prepare('UPDATE migration_jobs SET completed_items = completed_items + 1 WHERE owner_session_id = ? AND id = ?');
    return await stmt.run(ownerSessionId, id);
  }

  static async incrementFailed(ownerSessionId, id) {
    const stmt = db.prepare('UPDATE migration_jobs SET failed_items = failed_items + 1 WHERE owner_session_id = ? AND id = ?');
    return await stmt.run(ownerSessionId, id);
  }
}
