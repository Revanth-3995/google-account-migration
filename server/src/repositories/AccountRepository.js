import { db } from '../db/database.js';

export class AccountRepository {
  static get(id) {
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    return stmt.get(id);
  }

  static getByRole(role) {
    const stmt = db.prepare('SELECT * FROM accounts WHERE role = ?');
    return stmt.get(role);
  }

  static getAll() {
    const stmt = db.prepare('SELECT id, email, role, scopes, token_data, updated_at FROM accounts');
    return stmt.all();
  }

  static save({ id, email, role, scopes, tokenData }) {
    const stmt = db.prepare(`
      INSERT INTO accounts (id, email, role, scopes, token_data, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        scopes = excluded.scopes,
        token_data = excluded.token_data,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(id, email, role, scopes, JSON.stringify(tokenData));
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    return stmt.run(id);
  }
}
