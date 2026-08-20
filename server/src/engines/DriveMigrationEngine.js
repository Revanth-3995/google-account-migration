import { DriveService } from '../services/drive/DriveService.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { JobRepository } from '../repositories/JobRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';

export class DriveMigrationEngine {
  static async processItem(item, { sourceToken, destToken, destEmail, folderMap }) {
    const isFolder = item.item_type === 'FOLDER';
    const ownerSessionId = item.owner_session_id || '';

    try {
      await ItemRepository.updateStatus(ownerSessionId, item.id, 'PROCESSING');
      EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: 'PROCESSING' });

      const resolveParentId = () => {
        if (item.source_parent_id && folderMap.has(item.source_parent_id)) {
          return folderMap.get(item.source_parent_id);
        }
        if (item.parent_path && folderMap.has(item.parent_path)) {
          return folderMap.get(item.parent_path);
        }
        return 'root';
      };

      const targetParentId = resolveParentId();

      if (isFolder) {
        // Recreate directory in Account B
        await AuditRepository.log(ownerSessionId, {
          jobId: item.job_id,
          itemId: item.id,
          level: 'INFO',
          eventType: 'DRIVE_FOLDER_CREATE',
          message: `Creating destination folder: "${item.source_name}" in parent "${targetParentId}" (sourceParentId=${item.source_parent_id || 'root'})`
        });

        const res = await DriveService.createFolder(item.source_name, targetParentId, destToken);
        if (res.ok && res.folder) {
          folderMap.set(item.source_item_id, res.folder.id);
          if (item.parent_path) {
            folderMap.set(item.parent_path, res.folder.id);
          }
          await ItemRepository.updateDestParentId(ownerSessionId, item.id, targetParentId);
          await ItemRepository.updateStatus(ownerSessionId, item.id, 'COMPLETED', { destItemId: res.folder.id });
          await JobRepository.incrementCompleted(ownerSessionId, item.job_id);
          await AuditRepository.log(ownerSessionId, {
            jobId: item.job_id,
            itemId: item.id,
            level: 'INFO',
            eventType: 'DRIVE_FOLDER_DONE',
            message: `Created destination folder ID: ${res.folder.id} (destParentId=${targetParentId})`
          });
        } else {
          throw new Error(res.error || 'Failed to create destination folder');
        }
      } else {
        // 1. Share source file with Account B
        await AuditRepository.log(ownerSessionId, {
          jobId: item.job_id,
          itemId: item.id,
          level: 'INFO',
          eventType: 'DRIVE_SHARE',
          message: `Sharing source file "${item.source_name}" with Account B`
        });

        const shareRes = await DriveService.shareFile(item.source_item_id, destEmail, sourceToken);
        if (!shareRes.ok && shareRes.status !== 400) {
          throw new Error(`Share failed (HTTP ${shareRes.status}): ${shareRes.error}`);
        }

        // 2. Server-to-Server Copy into mapped destination parent
        await AuditRepository.log(ownerSessionId, {
          jobId: item.job_id,
          itemId: item.id,
          level: 'INFO',
          eventType: 'DRIVE_COPY',
          message: `Executing server-to-server copy for "${item.source_name}" into parent "${targetParentId}" (sourceParentId=${item.source_parent_id || 'root'}) (0 local bytes)`
        });

        const copyRes = await DriveService.copyFile(item.source_item_id, item.source_name, targetParentId, destToken);
        if (copyRes.ok && copyRes.file) {
          await ItemRepository.updateDestParentId(ownerSessionId, item.id, targetParentId);
          await ItemRepository.updateStatus(ownerSessionId, item.id, 'COMPLETED', { destItemId: copyRes.file.id });
          await JobRepository.incrementCompleted(ownerSessionId, item.job_id);
          await AuditRepository.log(ownerSessionId, {
            jobId: item.job_id,
            itemId: item.id,
            level: 'INFO',
            eventType: 'DRIVE_COPY_DONE',
            message: `Copied file successfully. Destination ID: ${copyRes.file.id} (destParentId=${targetParentId})`
          });
        } else {
          throw new Error(copyRes.error || 'Failed to copy file to destination');
        }
      }

      EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: 'COMPLETED' });
      return { success: true };

    } catch (err) {
      console.error(`Error processing Drive item ${item.source_name}:`, err.message);
      await ItemRepository.updateStatus(ownerSessionId, item.id, 'FAILED', { errorMessage: err.message });
      await JobRepository.incrementFailed(ownerSessionId, item.job_id);
      await AuditRepository.log(ownerSessionId, {
        jobId: item.job_id,
        itemId: item.id,
        level: 'ERROR',
        eventType: 'DRIVE_ITEM_ERROR',
        message: `Failed to process "${item.source_name}": ${err.message}`
      });
      EventBroadcaster.broadcast('ITEM_PROGRESS', { jobId: item.job_id, itemId: item.id, status: 'FAILED', error: err.message });
      return { success: false, error: err.message };
    }
  }
}
