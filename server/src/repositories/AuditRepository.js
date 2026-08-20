import { db } from '../db/database.js';

export class AuditRepository {
  static log({ jobId, itemId, level, eventType, message }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (job_id, item_id, level, event_type, message, timestamp)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(jobId || null, itemId || null, level || 'INFO', eventType || 'SYSTEM', message);
  }

  static getRecent(limit = 100) {
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?');
    return stmt.all(limit);
  }

  static getByJobId(jobId) {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE job_id = ? ORDER BY id ASC');
    return stmt.all(jobId);
  }
}
