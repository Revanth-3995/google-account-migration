import crypto from 'crypto';
import { db } from '../db/database.js';

export class AccountRepository {
  static async get(ownerSessionId, id) {
    const stmt = db.prepare('SELECT * FROM accounts WHERE owner_session_id = ? AND id = ?');
    return await stmt.get(ownerSessionId, id);
  }

  static async getByRole(ownerSessionId, role) {
    const stmt = db.prepare('SELECT * FROM accounts WHERE owner_session_id = ? AND role = ?');
    return await stmt.get(ownerSessionId, role);
  }

  static async getAll(ownerSessionId) {
    const stmt = db.prepare('SELECT id, email, role, scopes, token_data, updated_at FROM accounts WHERE owner_session_id = ? ORDER BY created_at ASC');
    return await stmt.all(ownerSessionId);
  }

  static async save(ownerSessionId, { id, email, role, scopes, tokenData }) {
    const stmt = db.prepare(`
      INSERT INTO accounts (id, owner_session_id, email, role, scopes, token_data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_session_id, role) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        scopes = excluded.scopes,
        token_data = excluded.token_data,
        updated_at = CURRENT_TIMESTAMP
    `);
    const rowId = id || crypto.randomUUID();
    return await stmt.run(rowId, ownerSessionId, email, role, scopes, JSON.stringify(tokenData));
  }

  static async delete(ownerSessionId, role) {
    const stmt = db.prepare('DELETE FROM accounts WHERE owner_session_id = ? AND role = ?');
    return await stmt.run(ownerSessionId, role);
  }
}
