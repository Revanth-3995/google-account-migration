import https from 'https';

export class DriveService {
  static async shareFile(fileId, destEmail, sourceToken) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: destEmail
      });

      const req = https.request({
        hostname: 'www.googleapis.com',
        port: 443,
        path: `/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sourceToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode });
          } else {
            resolve({ ok: false, status: res.statusCode, error: body });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  static async copyFile(sourceFileId, name, destParentId, destToken) {
    return new Promise((resolve, reject) => {
      const bodyObj = { name };
      if (destParentId && destParentId !== 'root') {
        bodyObj.parents = [destParentId];
      }
      const payload = JSON.stringify(bodyObj);

      const req = https.request({
        hostname: 'www.googleapis.com',
        port: 443,
        path: `/drive/v3/files/${sourceFileId}/copy?fields=id,name,owners,parents,size`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${destToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ ok: true, file: JSON.parse(body) });
            } catch (e) {
              resolve({ ok: true, raw: body });
            }
          } else {
            resolve({ ok: false, status: res.statusCode, error: body });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  static async createFolder(name, destParentId, destToken) {
    return new Promise((resolve, reject) => {
      const bodyObj = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (destParentId && destParentId !== 'root') {
        bodyObj.parents = [destParentId];
      }
      const payload = JSON.stringify(bodyObj);

      const req = https.request({
        hostname: 'www.googleapis.com',
        port: 443,
        path: '/drive/v3/files?fields=id,name,parents',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${destToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, folder: JSON.parse(body) });
          } else {
            resolve({ ok: false, status: res.statusCode, error: body });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // Paginate through all child files in a folder
  static async listChildren(folderId, sourceToken) {
    let allFiles = [];
    let pageToken = null;

    do {
      const pageResult = await new Promise((resolve, reject) => {
        const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
        let queryPath = `/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,size,parents,owners,capabilities)&pageSize=1000`;
        if (pageToken) {
          queryPath += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const req = https.get({
          hostname: 'www.googleapis.com',
          port: 443,
          path: queryPath,
          headers: { 'Authorization': `Bearer ${sourceToken}` }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve({ ok: true, data: JSON.parse(body) });
              } catch (e) {
                resolve({ ok: false, error: e.message });
              }
            } else {
              resolve({ ok: false, status: res.statusCode, error: body });
            }
          });
        });
        req.on('error', reject);
      });

      if (pageResult.ok && pageResult.data) {
        if (pageResult.data.files && Array.isArray(pageResult.data.files)) {
          allFiles.push(...pageResult.data.files);
        }
        pageToken = pageResult.data.nextPageToken || null;
      } else {
        pageToken = null;
      }
    } while (pageToken);

    return { ok: true, files: allFiles };
  }
}
