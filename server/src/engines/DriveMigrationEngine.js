import { DriveService } from '../services/drive/DriveService.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { JobRepository } from '../repositories/JobRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';

export class DriveMigrationEngine {
  static async processItem(item, { sourceToken, destToken, destEmail, folderMap }) {
    const isFolder = item.item_type === 'FOLDER';

    try {
      ItemRepository.updateStatus(item.id, 'PROCESSING');
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
        AuditRepository.log({
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
          ItemRepository.updateDestParentId(item.id, targetParentId);
          ItemRepository.updateStatus(item.id, 'COMPLETED', { destItemId: res.folder.id });
          JobRepository.incrementCompleted(item.job_id);
          AuditRepository.log({
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
        AuditRepository.log({
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
        AuditRepository.log({
          jobId: item.job_id,
          itemId: item.id,
          level: 'INFO',
          eventType: 'DRIVE_COPY',
          message: `Executing server-to-server copy for "${item.source_name}" into parent "${targetParentId}" (sourceParentId=${item.source_parent_id || 'root'}) (0 local bytes)`
        });

        const copyRes = await DriveService.copyFile(item.source_item_id, item.source_name, targetParentId, destToken);
        if (copyRes.ok && copyRes.file) {
          ItemRepository.updateDestParentId(item.id, targetParentId);
          ItemRepository.updateStatus(item.id, 'COMPLETED', { destItemId: copyRes.file.id });
          JobRepository.incrementCompleted(item.job_id);
          AuditRepository.log({
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
      ItemRepository.updateStatus(item.id, 'FAILED', { errorMessage: err.message });
      JobRepository.incrementFailed(item.job_id);
      AuditRepository.log({
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
