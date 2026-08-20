import { db } from '../db/database.js';

export class AuditRepository {
  static async log(ownerSessionId, { jobId, itemId, level, eventType, message }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (job_id, item_id, owner_session_id, level, event_type, message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return await stmt.run(jobId || null, itemId || null, ownerSessionId, level || 'INFO', eventType || 'SYSTEM', message);
  }

  static async getRecent(ownerSessionId, limit = 100) {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE owner_session_id = ? ORDER BY id DESC LIMIT ?');
    return await stmt.all(ownerSessionId, limit);
  }

  static async getByJobId(ownerSessionId, jobId) {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE owner_session_id = ? AND job_id = ? ORDER BY id ASC');
    return await stmt.all(ownerSessionId, jobId);
  }
}
