import { DriveService } from '../services/drive/DriveService.js';
import { AuthService } from '../services/auth/AuthService.js';
import { JobRepository } from '../repositories/JobRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';

export const DriveController = {
  async discoverManifest(req, res) {
    try {
      const { rootFolderId, rootFolderName } = req.body;
      const sourceToken = await AuthService.getSourceToken();
      if (!sourceToken) {
        return res.status(401).json({ error: 'Source account not connected' });
      }

      const discoveredFolders = [];
      const discoveredFiles = [];

      async function scan(folderId, currentPath, parentId = null) {
        discoveredFolders.push({
          id: folderId,
          name: currentPath.split('/').pop() || rootFolderName,
          path: currentPath,
          parentId
        });

        const listResult = await DriveService.listChildren(folderId, sourceToken);
        if (listResult.ok && listResult.files) {
          for (const item of listResult.files) {
            const itemPath = `${currentPath}/${item.name}`;
            if (item.mimeType === 'application/vnd.google-apps.folder') {
              await scan(item.id, itemPath, folderId);
            } else {
              discoveredFiles.push({
                id: item.id,
                name: item.name,
                mimeType: item.mimeType,
                size: item.size || 0,
                path: currentPath,
                parentId: folderId,
                canShare: item.capabilities ? item.capabilities.canShare : true
              });
            }
          }
        }
      }

      await scan(rootFolderId, `/${rootFolderName}`, null);

      res.json({
        rootFolderId,
        rootFolderName,
        folders: discoveredFolders,
        files: discoveredFiles,
        totalFolders: discoveredFolders.length,
        totalFiles: discoveredFiles.length
      });
    } catch (e) {
      console.error('Error discovering manifest:', e);
      res.status(500).json({ error: e.message });
    }
  },

  async createJob(req, res) {
    try {
      const { migrationMode, items } = req.body;

      // Sort Drive items: Folders first by path depth, then files alphabetically by path & filename
      const sortedItems = [...items].sort((a, b) => {
        const isFolderA = a.itemType === 'FOLDER' || a.mimeType === 'application/vnd.google-apps.folder';
        const isFolderB = b.itemType === 'FOLDER' || b.mimeType === 'application/vnd.google-apps.folder';
        if (isFolderA && !isFolderB) return -1;
        if (!isFolderA && isFolderB) return 1;

        const pathA = a.path || a.parent_path || '';
        const pathB = b.path || b.parent_path || '';
        if (pathA !== pathB) return pathA.localeCompare(pathB);
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      const accounts = await import('../repositories/AccountRepository.js');
      const src = await accounts.AccountRepository.get('source');
      const dst = await accounts.AccountRepository.get('destination');

      if (!src || !dst) {
        return res.status(400).json({ error: 'Both Source and Destination accounts must be connected.' });
      }

      const jobId = 'drive_' + Date.now();
      await JobRepository.create({
        id: jobId,
        serviceType: 'DRIVE',
        migrationMode: migrationMode || 'HIERARCHY',
        sourceEmail: src.email,
        destEmail: dst.email,
        status: 'READY',
        totalItems: items.length
      });

      const dbItems = sortedItems.map((it, idx) => ({
        id: `${jobId}_${idx + 1}`,
        job_id: jobId,
        source_item_id: it.id,
        source_name: it.name,
        mime_type: it.mimeType || null,
        size_bytes: it.size || 0,
        item_type: it.itemType || (it.mimeType === 'application/vnd.google-apps.folder' ? 'FOLDER' : 'FILE'),
        parent_path: it.path || '/',
        source_parent_id: it.parentId || null,
        dest_parent_id: null,
        dest_item_id: null,
        status: 'PENDING'
      }));

      await ItemRepository.createBatch(dbItems);

      await AuditRepository.log({
        jobId,
        level: 'INFO',
        eventType: 'JOB_CREATE',
        message: `Created Drive Migration Job with ${items.length} item(s)`
      });

      EventBroadcaster.broadcast('JOB_CREATED', { jobId });
      res.json({ success: true, jobId, totalItems: items.length });
    } catch (e) {
      console.error('Error creating Drive job:', e);
      res.status(500).json({ error: e.message });
    }
  }
};
