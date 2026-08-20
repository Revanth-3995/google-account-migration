import { AccountRepository } from '../repositories/AccountRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';

export const AccountController = {
  async getAccounts(req, res) {
    try {
      const accounts = await AccountRepository.getAll(req.ownerSessionId);
      const safeAccounts = accounts.map(account => {
        let tokenData = null;
        if (account.token_data) {
          try {
            const parsed = typeof account.token_data === 'string' ? JSON.parse(account.token_data) : account.token_data;
            const { access_token, refresh_token, ...safeTokenData } = parsed || {};
            tokenData = safeTokenData;
          } catch {
            tokenData = null;
          }
        }
        return {
          ...account,
          token_data: tokenData
        };
      });
      res.json(safeAccounts);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async saveAccount(req, res) {
    try {
      const { id, email, role, scopes, tokenData } = req.body;
      if (!email || !role || !scopes) {
        return res.status(400).json({ error: 'Missing required account fields' });
      }
      await AccountRepository.save(req.ownerSessionId, { id: null, email, role, scopes, tokenData });
      await AuditRepository.log(req.ownerSessionId, {
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
      const { id: role } = req.params;
      await AccountRepository.delete(req.ownerSessionId, role);
      await AuditRepository.log(req.ownerSessionId, {
        level: 'INFO',
        eventType: 'ACCOUNT_DISCONNECT',
        message: `Disconnected account role: ${role}`
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};
