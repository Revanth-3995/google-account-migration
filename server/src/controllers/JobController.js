import { JobRepository } from '../repositories/JobRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { JobQueue } from '../jobs/JobQueue.js';

export const JobController = {
  async getAllJobs(req, res) {
    try {
      const jobs = await JobRepository.getAll(req.ownerSessionId);
      res.json(jobs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async getJobDetails(req, res) {
    try {
      const { id } = req.params;
      const job = await JobRepository.get(req.ownerSessionId, id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const items = await ItemRepository.getByJobId(req.ownerSessionId, id);
      const audit = await AuditRepository.getByJobId(req.ownerSessionId, id);
      res.json({ job, items, audit });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async startJob(req, res) {
    try {
      const { id } = req.params;
      await JobQueue.startJob(req.ownerSessionId, id);
      res.json({ success: true, status: 'RUNNING' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async retryJob(req, res) {
    try {
      const { id } = req.params;
      await JobQueue.startJob(req.ownerSessionId, id, true);
      res.json({ success: true, status: 'RUNNING' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async pauseJob(req, res) {
    try {
      const { id } = req.params;
      await JobQueue.pauseJob(req.ownerSessionId, id);
      res.json({ success: true, status: 'PAUSED' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async cancelJob(req, res) {
    try {
      const { id } = req.params;
      await JobQueue.cancelJob(req.ownerSessionId, id);
      res.json({ success: true, status: 'CANCELLED' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};
