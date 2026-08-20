import { db } from '../db/database.js';

export class ItemRepository {
  static async createBatch(ownerSessionId, items) {
    const stmt = db.prepare(`
      INSERT INTO migration_items (
        id, job_id, owner_session_id, source_item_id, source_name, mime_type, size_bytes, item_type,
        parent_path, source_parent_id, dest_parent_id, dest_item_id, status, fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      stmt.run(
        it.id,
        it.job_id,
        ownerSessionId,
        it.source_item_id,
        it.source_name,
        it.mime_type || null,
        it.size_bytes || 0,
        it.item_type || 'FILE',
        it.parent_path || '/',
        it.source_parent_id || null,
        it.dest_parent_id || null,
        it.dest_item_id || null,
        it.status || 'PENDING',
        it.fingerprint || null
      );
    }
  }

  static async getByJobId(ownerSessionId, jobId) {
    const stmt = db.prepare('SELECT * FROM migration_items WHERE owner_session_id = ? AND job_id = ? ORDER BY created_at ASC');
    return await stmt.all(ownerSessionId, jobId);
  }

  static async getPendingItems(ownerSessionId, jobId) {
    const stmt = db.prepare("SELECT * FROM migration_items WHERE owner_session_id = ? AND job_id = ? AND status NOT IN ('COMPLETED','VERIFIED') ORDER BY created_at ASC");
    return await stmt.all(ownerSessionId, jobId);
  }

  static async updateStatus(ownerSessionId, id, status, { destItemId, errorMessage } = {}) {
    const stmt = db.prepare(`
      UPDATE migration_items
      SET status = ?, dest_item_id = COALESCE(?, dest_item_id), error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE owner_session_id = ? AND id = ?
    `);
    return await stmt.run(status, destItemId || null, errorMessage || null, ownerSessionId, id);
  }

  static async updateDestParentId(ownerSessionId, id, destParentId) {
    const stmt = db.prepare('UPDATE migration_items SET dest_parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE owner_session_id = ? AND id = ?');
    return await stmt.run(destParentId, ownerSessionId, id);
  }

  static async updateRetryCount(ownerSessionId, id, retryCount) {
    const stmt = db.prepare('UPDATE migration_items SET retry_count = ?, updated_at = CURRENT_TIMESTAMP WHERE owner_session_id = ? AND id = ?');
    return await stmt.run(retryCount, ownerSessionId, id);
  }
}


