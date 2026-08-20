import { JobRepository } from '../repositories/JobRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { AuthService } from '../services/auth/AuthService.js';
import { DriveMigrationEngine } from '../engines/DriveMigrationEngine.js';
import { PhotosMigrationEngine } from '../engines/PhotosMigrationEngine.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';
import { db } from '../db/database.js';

const activeJobs = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class JobQueue {
  static async init() {
    console.log('[JobQueue] Initializing application startup recovery...');
    // Recover interrupted jobs (RUNNING, PAUSED with ambiguous PROCESSING items)
    const stmt = db.prepare(`SELECT id, status FROM migration_jobs WHERE status IN ('RUNNING', 'PAUSED')`);
    const interruptedJobs = await stmt.all();

    for (const job of interruptedJobs) {
      console.log(`[JobQueue] Recovering interrupted job ${job.id}`);
      await db.prepare(`UPDATE migration_items SET status = 'PENDING' WHERE job_id = ? AND status = 'PROCESSING'`).run(job.id);
      
      // If we restart, mark RUNNING jobs as PAUSED so the user can manually resume them
      if (job.status === 'RUNNING') {
        await JobRepository.updateStatus(job.id, 'PAUSED');
      }
    }
  }

  static async startJob(jobId, retryOnly = false) {
    const job = await JobRepository.get(jobId);
    if (!job) throw new Error('Job not found');

    if (retryOnly) {
      // Reset failed and auth_required items to PENDING
      const failedItems = (await ItemRepository.getByJobId(jobId)).filter(i => 
        i.status === 'FAILED' || i.status === 'FAILED_RETRYABLE' || i.status === 'AUTH_REQUIRED'
      );
      for (const fi of failedItems) {
        await ItemRepository.updateStatus(fi.id, 'PENDING');
      }
      await JobRepository.updateStatus(jobId, 'RUNNING', { failed_items: 0 });
    } else {
      await JobRepository.updateStatus(jobId, 'RUNNING');
    }

    EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: 'RUNNING' });
    await AuditRepository.log({ jobId, level: 'INFO', eventType: 'JOB_START', message: `Job started (${job.service_type})` });

    const sourceToken = await AuthService.getSourceToken();
    const destToken = await AuthService.getDestToken();

    if (!sourceToken || !destToken) {
      await JobRepository.updateStatus(jobId, 'AUTH_REQUIRED');
      EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: 'AUTH_REQUIRED', error: 'Missing active account tokens' });
      return;
    }

    const state = {
      jobId,
      paused: false,
      cancelled: false,
      folderMap: new Map(),
      authRequired: false,
      recoveryRequired: false
    };
    activeJobs.set(jobId, state);

    // Run in background
    (async () => {
      try {
        const pendingItems = await ItemRepository.getPendingItems(jobId);

        if (job.service_type === 'DRIVE') {
          const folders = pendingItems.filter(i => i.item_type === 'FOLDER');
          const files = pendingItems.filter(i => i.item_type !== 'FOLDER');
          folders.sort((a, b) => {
            const depthA = (a.parent_path || '/').split('/').filter(Boolean).length;
            const depthB = (b.parent_path || '/').split('/').filter(Boolean).length;
            if (depthA !== depthB) return depthA - depthB;
            return (a.parent_path || '').localeCompare(b.parent_path || '') || (a.source_name || '').localeCompare(b.source_name || '', undefined, { numeric: true, sensitivity: 'base' });
          });

          for (const folder of folders) {
            if (state.paused || state.cancelled || state.authRequired || state.recoveryRequired) break;
            await DriveMigrationEngine.processItem(folder, {
              sourceToken,
              destToken,
              destEmail: job.dest_email,
              folderMap: state.folderMap
            });
          }

          const concurrency = 2;
          let idx = 0;
          const workers = Array(concurrency).fill(null).map(async () => {
            while (idx < files.length) {
              if (state.paused || state.cancelled || state.authRequired || state.recoveryRequired) break;
              const item = files[idx++];
              await DriveMigrationEngine.processItem(item, {
                sourceToken,
                destToken,
                destEmail: job.dest_email,
                folderMap: state.folderMap
              });
            }
          });
          await Promise.all(workers);

        } else if (job.service_type === 'PHOTOS') {
          // Photos API requires strictly sequential write requests to avoid 429 concurrent write limits
          for (let i = 0; i < pendingItems.length; i++) {
            if (state.paused || state.cancelled || state.authRequired || state.recoveryRequired) break;
            const item = pendingItems[i];
            const result = await PhotosMigrationEngine.processItem(item, {
              sourceToken,
              destToken
            });
            
            if (result && !result.success) {
              if (result.errorType === 'AUTH_REQUIRED') {
                state.authRequired = true;
              } else if (result.errorType === 'SOURCE_ACCESS_EXPIRED') {
                state.recoveryRequired = true;
              }
            }
            
            // Small 400ms throttle between items to stay well below Google write quotas
            await sleep(400);
          }
        }

        const allItems = await ItemRepository.getByJobId(jobId);
        // Treat VERIFIED same as COMPLETED for accounting
        const completedCount = allItems.filter(i => i.status === 'COMPLETED' || i.status === 'VERIFIED').length;
        const failedCount = allItems.filter(i => i.status === 'FAILED' || i.status === 'FAILED_RETRYABLE' || i.status === 'AUTH_REQUIRED' || i.status === 'SOURCE_ACCESS_EXPIRED').length;

        const finalStatus = state.cancelled ? 'CANCELLED' :
          state.authRequired ? 'AUTH_REQUIRED' :
          state.recoveryRequired ? 'RECOVERY_REQUIRED' :
          state.paused ? 'PAUSED' :
          (failedCount > 0 && completedCount > 0) ? 'COMPLETED_WITH_ERRORS' :
          (failedCount > 0 && completedCount === 0) ? 'FAILED' : 'COMPLETED';

        await JobRepository.updateStatus(jobId, finalStatus, {
          completed_items: completedCount,
          failed_items: failedCount
        });

        EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: finalStatus });
        await AuditRepository.log({ jobId, level: 'INFO', eventType: 'JOB_FINISH', message: `Job finished with status: ${finalStatus} (${completedCount} completed, ${failedCount} failed)` });

      } catch (err) {
        console.error('Job queue error:', err);
        await JobRepository.updateStatus(jobId, 'FAILED');
        EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: 'FAILED', error: err.message });
      } finally {
        activeJobs.delete(jobId);
      }
    })();
  }

  static async pauseJob(jobId) {
    const state = activeJobs.get(jobId);
    if (state) {
      state.paused = true;
      await JobRepository.updateStatus(jobId, 'PAUSED');
      EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: 'PAUSED' });
      return true;
    }
    return false;
  }

  static async cancelJob(jobId) {
    const state = activeJobs.get(jobId);
    if (state) {
      state.cancelled = true;
    }
    await JobRepository.updateStatus(jobId, 'CANCELLED');
    EventBroadcaster.broadcast('JOB_STATUS', { jobId, status: 'CANCELLED' });
    return true;
  }
}
