import { AccountRepository } from '../repositories/AccountRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';

export const AccountController = {
  async getAccounts(req, res) {
    try {
      const accounts = await AccountRepository.getAll();
      res.json(accounts);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async saveAccount(req, res) {
    try {
      const { id, email, role, scopes, tokenData } = req.body;
      if (!id || !email || !role || !scopes) {
        return res.status(400).json({ error: 'Missing required account fields' });
      }
      await AccountRepository.save({ id, email, role, scopes, tokenData });
      await AuditRepository.log({
        level: 'INFO',
        eventType: 'ACCOUNT_CONNECT',
        message: `Connected ${role} account: ${email} (${scopes})`
      });
      res.json({ success: true, email, role });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async deleteAccount(req, res) {
    try {
      const { id } = req.params;
      await AccountRepository.delete(id);
      await AuditRepository.log({
        level: 'INFO',
        eventType: 'ACCOUNT_DISCONNECT',
        message: `Disconnected account: ${id}`
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};
