import { PhotosService } from '../services/photos/PhotosService.js';
import { AuthService } from '../services/auth/AuthService.js';
import { JobRepository } from '../repositories/JobRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';
import { buildPhotoFingerprint } from '../utils/fingerprintUtils.js';

export const PhotosController = {
  async createSession(req, res) {
    try {
      const sourceToken = AuthService.getSourceToken();
      if (!sourceToken) return res.status(401).json({ error: 'Source account not connected' });

      const result = await PhotosService.createSession(sourceToken);
      res.status(result.statusCode).json(result.data || result.raw);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async getSession(req, res) {
    try {
      const sourceToken = AuthService.getSourceToken();
      const result = await PhotosService.getSession(req.params.id, sourceToken);
      res.status(result.statusCode).json(result.data || result.raw);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async getMediaItems(req, res) {
    try {
      const sourceToken = AuthService.getSourceToken();
      const result = await PhotosService.getMediaItems(req.params.id, sourceToken);
      res.status(result.statusCode).json(result.data || result.raw);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async deleteSession(req, res) {
    try {
      const sourceToken = AuthService.getSourceToken();
      const result = await PhotosService.deleteSession(req.params.id, sourceToken);
      res.status(result.statusCode).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/photos/resume-recovery
  // Strict fingerprint-based recovery matching.
  // Does NOT resume the job unless every unfinished item has been safely matched (canResume = true).
  async resumeRecovery(req, res) {
    try {
      const { jobId, items } = req.body;
      if (!jobId || !items || !items.length) {
        return res.status(400).json({ error: 'Missing jobId or items' });
      }

      // Verify job exists and is actually in a recoverable state
      const job = JobRepository.get(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.status !== 'RECOVERY_REQUIRED' && job.status !== 'PAUSED') {
        return res.status(400).json({ error: 'Job is not in a recoverable state. Current status: ' + job.status });
      }

      const allItems = ItemRepository.getByJobId(jobId);
      const verifiedItems = allItems.filter(i => i.status === 'VERIFIED' || i.status === 'COMPLETED');
      // All items that still need source access refreshed
      const unfinishedItems = allItems.filter(i => i.status !== 'VERIFIED' && i.status !== 'COMPLETED');

      // Work on a mutable copy so we can drain matched items from the pool
      const unfinishedPool = [...unfinishedItems];

      let matched = 0;
      let unmatched = 0;
      let ambiguous = 0;
      let alreadyVerified = 0;

      // Map of db item id -> new baseUrl, built up during matching
      const pendingUpdates = [];

      for (const freshItem of items) {
        const freshFingerprint = buildPhotoFingerprint(freshItem);

        // Ignore items already completed/verified - just count them
        if (verifiedItems.some(v => v.fingerprint === freshFingerprint)) {
          alreadyVerified++;
          continue;
        }

        // Find all unfinished DB items matching this fingerprint
        const candidates = unfinishedPool.filter(i => i.fingerprint === freshFingerprint);

        if (candidates.length === 0) {
          unmatched++;
        } else if (candidates.length > 1) {
          // AMBIGUOUS: Do NOT update any source URL. Do NOT guess.
          ambiguous++;
        } else {
          // SAFE_MATCH: Exactly one unfinished item matches.
          const matchedItem = candidates[0];
          const newBaseUrl = (freshItem.mediaFile && freshItem.mediaFile.baseUrl) || freshItem.baseUrl || '';

          if (!newBaseUrl) {
            // Fresh item has no usable URL - treat as unmatched
            unmatched++;
          } else {
            // Remove from pool immediately so a duplicate picker entry can't match it again
            const poolIdx = unfinishedPool.indexOf(matchedItem);
            unfinishedPool.splice(poolIdx, 1);
            pendingUpdates.push({ id: matchedItem.id, newBaseUrl });
            matched++;
          }
        }
      }

      // requiredRemaining = unfinished items not yet safely matched
      const requiredRemaining = unfinishedPool.length; // what's left in pool = still unmatched
      const canResume = requiredRemaining === 0 && ambiguous === 0;

      // Apply DB updates for safe matches
      if (pendingUpdates.length > 0) {
        const { db } = await import('../db/database.js');
        const updateStmt = db.prepare('UPDATE migration_items SET source_item_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        for (const upd of pendingUpdates) {
          updateStmt.run(upd.newBaseUrl, 'PENDING', upd.id);
        }
      }

      const logMsg = 'Recovery match result: matched=' + matched + ' unmatched=' + unmatched + ' ambiguous=' + ambiguous + ' alreadyVerified=' + alreadyVerified + ' requiredRemaining=' + requiredRemaining + ' canResume=' + canResume;

      if (canResume) {
        // Only now is it safe to resume
        AuditRepository.log({ jobId, level: 'INFO', eventType: 'RECOVERY_RESUME', message: logMsg });
        // Dynamically import to avoid any circular dependency issues
        import('../jobs/JobQueue.js').then(jq => jq.JobQueue.startJob(jobId, true));
      } else {
        AuditRepository.log({ jobId, level: 'WARN', eventType: 'RECOVERY_INCOMPLETE', message: logMsg });
      }

      res.json({
        success: true,
        matched,
        unmatched,
        ambiguous,
        alreadyVerified,
        requiredRemaining,
        canResume
      });

    } catch (e) {
      console.error('resumeRecovery error:', e);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/photos/jobs
  async createJob(req, res) {
    try {
      const { items } = req.body;

      // Sort items chronologically by capture date / createTime (oldest first), then by natural filename
      const sortedItems = [...items].sort((a, b) => {
        const timeA = new Date(a.createTime || (a.mediaFile && a.mediaFile.createTime) || 0).getTime();
        const timeB = new Date(b.createTime || (b.mediaFile && b.mediaFile.createTime) || 0).getTime();
        if (timeA && timeB && timeA !== timeB) return timeA - timeB;
        const nameA = (a.mediaFile && a.mediaFile.filename) || a.filename || '';
        const nameB = (b.mediaFile && b.mediaFile.filename) || b.filename || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const accounts = await import('../repositories/AccountRepository.js');
      const src = accounts.AccountRepository.get('source');
      const dst = accounts.AccountRepository.get('destination');

      if (!src || !dst) {
        return res.status(400).json({ error: 'Both Source and Destination accounts must be connected.' });
      }

      const jobId = 'photos_' + Date.now();
      JobRepository.create({
        id: jobId,
        serviceType: 'PHOTOS',
        migrationMode: 'IN_MEMORY_STREAM',
        sourceEmail: src.email,
        destEmail: dst.email,
        status: 'READY',
        totalItems: items.length
      });

      const dbItems = sortedItems.map((it, idx) => {
        const baseUrl = (it.mediaFile && it.mediaFile.baseUrl) || it.baseUrl || '';
        const fileName = (it.mediaFile && it.mediaFile.filename) || it.filename || ('photo_' + (idx + 1) + '.jpg');
        const mimeType = (it.mediaFile && it.mediaFile.mimeType) || it.mimeType || 'image/jpeg';
        const itemType = (it.type === 'VIDEO' || mimeType.startsWith('video/')) ? 'VIDEO' : 'PHOTO';
        // Use the single shared fingerprint function - same as used in recovery matching
        const fingerprint = buildPhotoFingerprint(it);

        return {
          id: jobId + '_' + (idx + 1),
          job_id: jobId,
          // source_item_id stores the temporary baseUrl for Photos - this is intentional for this architecture
          source_item_id: baseUrl,
          source_name: fileName,
          mime_type: mimeType,
          size_bytes: 0,
          item_type: itemType,
          parent_path: '/',
          source_parent_id: null,
          dest_parent_id: null,
          dest_item_id: null,
          status: 'PENDING',
          fingerprint
        };
      });

      ItemRepository.createBatch(dbItems);

      AuditRepository.log({
        jobId,
        level: 'INFO',
        eventType: 'JOB_CREATE',
        message: 'Created Photos Migration Job with ' + items.length + ' item(s) (In-Memory Relay)'
      });

      EventBroadcaster.broadcast('JOB_CREATED', { jobId });
      res.json({ success: true, jobId, totalItems: items.length });
    } catch (e) {
      console.error('Error creating Photos job:', e);
      res.status(500).json({ error: e.message });
    }
  }
};
