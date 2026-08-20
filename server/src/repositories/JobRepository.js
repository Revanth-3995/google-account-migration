import { db } from '../db/database.js';

export class JobRepository {
  static create({ id, serviceType, migrationMode, sourceEmail, destEmail, status, totalItems }) {
    const stmt = db.prepare(`
      INSERT INTO migration_jobs (
        id, service_type, migration_mode, source_email, dest_email, status, total_items, completed_items, failed_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);
    return stmt.run(id, serviceType, migrationMode, sourceEmail, destEmail, status || 'READY', totalItems || 0);
  }

  static get(id) {
    const stmt = db.prepare('SELECT * FROM migration_jobs WHERE id = ?');
    return stmt.get(id);
  }

  static getAll() {
    const stmt = db.prepare('SELECT * FROM migration_jobs ORDER BY created_at DESC');
    return stmt.all();
  }

  static updateStatus(id, status, extra = {}) {
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

    sql += ' WHERE id = ?';
    params.push(id);

    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }

  static incrementCompleted(id) {
    const stmt = db.prepare('UPDATE migration_jobs SET completed_items = completed_items + 1 WHERE id = ?');
    return stmt.run(id);
  }

  static incrementFailed(id) {
    const stmt = db.prepare('UPDATE migration_jobs SET failed_items = failed_items + 1 WHERE id = ?');
    return stmt.run(id);
  }
}
