import { PhotosService } from '../services/photos/PhotosService.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { JobRepository } from '../repositories/JobRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class PhotosMigrationEngine {
  static async processItem(item, { sourceToken, destToken }) {
    if (item.status === 'VERIFIED' || item.status === 'COMPLETED') {
      return { success: true, skipped: true };
    }

    const maxRetries = 3;
    let attempt = item.retry_count || 0;

    const isVideo = item.item_type === 'VIDEO' ||
      (item.mime_type && item.mime_type.startsWith('video/')) ||
      /\.(mp4|mov|avi|mkv|3gp|m4v|webm)$/i.test(item.source_name);

    // Google Photos API requires '=dv' to download the actual full-length video bytes instead of a 75KB thumbnail frame ('=d')
    const downloadParam = isVideo ? '=dv' : '=d';
    const baseUrl = item.source_item_id.startsWith('http') ? item.source_item_id : '';
    const downloadUrl = baseUrl ? `${baseUrl}${downloadParam}` : item.source_item_id;

    while (attempt <= maxRetries) {
      try {
        ItemRepository.updateStatus(item.id, 'PROCESSING');
        EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: 'PROCESSING' });

        const mode = (process.env.PHOTOS_TRANSFER_MODE === 'buffer') ? 'BUFFER' : 'PIPE';
        AuditRepository.log({
          jobId: item.job_id,
          itemId: item.id,
          level: 'INFO',
          eventType: 'PHOTOS_STREAM_START',
          message: `[${mode}] Streaming ${isVideo ? 'VIDEO' : 'PHOTO'} "${item.source_name}" (Attempt ${attempt + 1})`
        });

        const _transferStart = Date.now();
        const streamResult = await PhotosService.streamAndUploadMedia({
          downloadUrl,
          fileName: item.source_name,
          mimeType: item.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          sourceToken,
          destToken
        });
        const _transferMs = Date.now() - _transferStart;

        const createData = streamResult.createResult.data || {};
        const newItems = createData.newMediaItemResults || [];
        const firstResult = newItems[0] || {};

        if (createData.error && createData.error.code === 429) {
          throw new Error(`RateLimit: ${createData.error.message}`);
        }

        if (firstResult.status && firstResult.status.message === 'Success') {
          const destMediaId = firstResult.mediaItem ? firstResult.mediaItem.id : 'created';
          // Immediately transactional update to VERIFIED
          ItemRepository.updateStatus(item.id, 'VERIFIED', { destItemId: destMediaId });
          JobRepository.incrementCompleted(item.job_id);

          AuditRepository.log({
            jobId: item.job_id,
            itemId: item.id,
            level: 'INFO',
            eventType: 'PHOTOS_UPLOAD_DONE',
            message: `[${mode}] Done "${item.source_name}" | time=${_transferMs}ms`
          });

          EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: 'VERIFIED', destMediaId });
          return { success: true };
        } else {
          const errMsg = (firstResult.status && firstResult.status.message) || JSON.stringify(createData);
          throw new Error(`BatchCreate failed: ${errMsg}`);
        }

      } catch (err) {
        attempt++;
        dbIncrementRetry(item.id, attempt);
        
        // Error classification
        if (err.statusCode === 401) {
          ItemRepository.updateStatus(item.id, 'AUTH_REQUIRED', { errorMessage: err.message });
          AuditRepository.log({ jobId: item.job_id, itemId: item.id, level: 'ERROR', eventType: 'AUTH_REQUIRED', message: err.message });
          return { success: false, errorType: 'AUTH_REQUIRED', error: err.message };
        }

        if (err.statusCode === 403 && err.source === 'SOURCE_DOWNLOAD') {
          ItemRepository.updateStatus(item.id, 'SOURCE_ACCESS_EXPIRED', { errorMessage: err.message });
          AuditRepository.log({ jobId: item.job_id, itemId: item.id, level: 'ERROR', eventType: 'SOURCE_ACCESS_EXPIRED', message: err.message });
          return { success: false, errorType: 'SOURCE_ACCESS_EXPIRED', error: err.message };
        }

        const isRateLimit = err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('concurrent write');

        if ((isRateLimit || err.statusCode >= 500) && attempt <= maxRetries) {
          const backoff = attempt * 2500;
          AuditRepository.log({
            jobId: item.job_id,
            itemId: item.id,
            level: 'WARN',
            eventType: 'RATE_LIMIT_BACKOFF',
            message: `Rate limit or transient error for "${item.source_name}". Waiting ${backoff / 1000}s (Retry ${attempt}/${maxRetries})`
          });
          await sleep(backoff);
          continue;
        }

        console.error(`Error migrating ${item.source_name}:`, err.message);
        ItemRepository.updateStatus(item.id, attempt > maxRetries ? 'FAILED' : 'FAILED_RETRYABLE', { errorMessage: err.message });
        if (attempt > maxRetries) JobRepository.incrementFailed(item.job_id);

        AuditRepository.log({
          jobId: item.job_id,
          itemId: item.id,
          level: 'ERROR',
          eventType: 'PHOTOS_ITEM_ERROR',
          message: `Failed to migrate "${item.source_name}": ${err.message}`
        });

        EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: attempt > maxRetries ? 'FAILED' : 'FAILED_RETRYABLE', error: err.message });
        return { success: false, error: err.message };
      }
    }
  }
}

function dbIncrementRetry(id, count) {
  // Hacky way to inject it if not explicitly in repo class
  import('../repositories/ItemRepository.js').then(m => {
    import('../db/database.js').then(dbMod => {
      try {
        dbMod.db.prepare('UPDATE migration_items SET retry_count = ? WHERE id = ?').run(count, id);
      } catch(e){}
    });
  });
}
