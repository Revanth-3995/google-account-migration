import { AuditRepository } from '../repositories/AuditRepository.js';

export const AuditController = {
  async getRecentLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit || '100', 10);
      const logs = await AuditRepository.getRecent(limit);
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};
