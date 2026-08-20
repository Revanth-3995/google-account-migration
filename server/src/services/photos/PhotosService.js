import https from 'https';

function fetchStreamWithRedirect(url, headers, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        // Follow Google Video CDN redirect
        const redirectUrl = new URL(res.headers.location, url).toString();
        return resolve(fetchStreamWithRedirect(redirectUrl, headers, maxRedirects - 1));
      }
      resolve(res);
    }).on('error', reject);
  });
}

export class PhotosService {
  static async createSession(sourceToken) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'photospicker.googleapis.com',
        port: 443,
        path: '/v1/sessions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sourceToken}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  static async getSession(sessionId, sourceToken) {
    return new Promise((resolve, reject) => {
      const req = https.get({
        hostname: 'photospicker.googleapis.com',
        port: 443,
        path: `/v1/sessions/${sessionId}`,
        headers: { 'Authorization': `Bearer ${sourceToken}` }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      });
      req.on('error', reject);
    });
  }

  static async getMediaItems(sessionId, sourceToken) {
    let allItems = [];
    let pageToken = null;

    do {
      const pageResult = await new Promise((resolve, reject) => {
        let queryPath = `/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
        if (pageToken) {
          queryPath += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const req = https.get({
          hostname: 'photospicker.googleapis.com',
          port: 443,
          path: queryPath,
          headers: { 'Authorization': `Bearer ${sourceToken}` }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
            } catch (e) {
              resolve({ statusCode: res.statusCode, raw: body });
            }
          });
        });
        req.on('error', reject);
      });

      if (pageResult.statusCode === 200 && pageResult.data) {
        if (pageResult.data.mediaItems && Array.isArray(pageResult.data.mediaItems)) {
          allItems.push(...pageResult.data.mediaItems);
        }
        pageToken = pageResult.data.nextPageToken || null;
      } else {
        pageToken = null;
      }
    } while (pageToken);

    return {
      statusCode: 200,
      data: {
        mediaItems: allItems,
        totalCount: allItems.length
      }
    };
  }

  static async deleteSession(sessionId, sourceToken) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'photospicker.googleapis.com',
        port: 443,
        path: `/v1/sessions/${sessionId}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sourceToken}` }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ statusCode: res.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  static async streamAndUploadMedia({ downloadUrl, fileName, mimeType, sourceToken, destToken }) {
    // Step 1: Probe / stream from source with automatic HTTP 302/301 redirect following
    const uploadToken = await new Promise(async (resolve, reject) => {
      try {
        const downloadRes = await fetchStreamWithRedirect(downloadUrl, {
          'Authorization': `Bearer ${sourceToken}`
        });

        if (downloadRes.statusCode !== 200) {
          const err = new Error(`Source download failed with HTTP ${downloadRes.statusCode}`);
          err.statusCode = downloadRes.statusCode;
          err.source = 'SOURCE_DOWNLOAD';
          return reject(err);
        }

        const contentLength = parseInt(downloadRes.headers['content-length'] || '0', 10);
        const STREAM_THRESHOLD = 200 * 1024 * 1024; // 200 MB threshold

        if (contentLength > STREAM_THRESHOLD) {
          // Large Video Mode (>200 MB): Resumable stream piping
          const uploadUrl = await new Promise((resUrl, rejUrl) => {
            const startReq = https.request({
              hostname: 'photoslibrary.googleapis.com',
              port: 443,
              path: '/v1/uploads',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${destToken}`,
                'Content-Length': '0',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Content-Type': mimeType || 'video/mp4',
                'X-Goog-Upload-Raw-Size': contentLength.toString()
              }
            }, (startRes) => {
              const url = startRes.headers['x-goog-upload-url'];
              if (url) resUrl(url);
              else rejUrl(new Error(`Failed to get resumable upload URL: HTTP ${startRes.statusCode}`));
            });
            startReq.on('error', rejUrl);
            startReq.end();
          });

          const uploadUrlObj = new URL(uploadUrl);
          const pipeReq = https.request({
            hostname: uploadUrlObj.hostname,
            port: 443,
            path: uploadUrlObj.pathname + uploadUrlObj.search,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${destToken}`,
              'X-Goog-Upload-Command': 'upload, finalize',
              'X-Goog-Upload-Offset': '0',
              'Content-Length': contentLength.toString()
            }
          }, (pipeRes) => {
            let tokenBody = '';
            pipeRes.on('data', c => tokenBody += c);
            pipeRes.on('end', () => {
              if (pipeRes.statusCode === 200) resolve(tokenBody.trim());
              else reject(new Error(`Resumable pipe upload failed (HTTP ${pipeRes.statusCode}): ${tokenBody}`));
            });
          });
          pipeReq.on('error', reject);
          downloadRes.pipe(pipeReq);

        } else if (contentLength > 0) {
          // MODE TOGGLE: PHOTOS_TRANSFER_MODE=buffer → old buffer mode, anything else → direct pipe
          const useLegacyBuffer = (process.env.PHOTOS_TRANSFER_MODE === 'buffer');

          if (!useLegacyBuffer) {
            // PIPE MODE: Download + upload simultaneously (no RAM buffer)
            const rawReq = https.request({
              hostname: 'photoslibrary.googleapis.com',
              port: 443,
              path: '/v1/uploads',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${destToken}`,
                'Content-Type': 'application/octet-stream',
                'X-Goog-Upload-Protocol': 'raw',
                'X-Goog-Upload-Content-Type': mimeType || 'image/jpeg',
                'Content-Length': contentLength.toString()
              }
            }, (rawRes) => {
              let tokenBody = '';
              rawRes.on('data', c => tokenBody += c);
              rawRes.on('end', () => {
                if (rawRes.statusCode === 200) resolve(tokenBody.trim());
                else reject(new Error(`Raw pipe upload failed (HTTP ${rawRes.statusCode}): ${tokenBody}`));
              });
            });
            rawReq.on('error', reject);
            downloadRes.pipe(rawReq);
          } else {
            // BUFFER MODE: Download fully into RAM, then upload (legacy behaviour)
            const chunks = [];
            downloadRes.on('data', c => chunks.push(c));
            downloadRes.on('end', () => {
              const buffer = Buffer.concat(chunks);
              const rawReq = https.request({
                hostname: 'photoslibrary.googleapis.com',
                port: 443,
                path: '/v1/uploads',
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${destToken}`,
                  'Content-Type': 'application/octet-stream',
                  'X-Goog-Upload-Protocol': 'raw',
                  'X-Goog-Upload-Content-Type': mimeType || 'image/jpeg',
                  'Content-Length': buffer.length
                }
              }, (rawRes) => {
                let tokenBody = '';
                rawRes.on('data', c => tokenBody += c);
                rawRes.on('end', () => {
                  if (rawRes.statusCode === 200) resolve(tokenBody.trim());
                  else reject(new Error(`Raw buffer upload failed (HTTP ${rawRes.statusCode}): ${tokenBody}`));
                });
              });
              rawReq.on('error', reject);
              rawReq.write(buffer);
              rawReq.end();
            });
          }
        } else {
          // Fallback: Content-Length completely missing (Google edge case)
          const chunks = [];
          downloadRes.on('data', c => chunks.push(c));
          downloadRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const rawReq = https.request({
              hostname: 'photoslibrary.googleapis.com',
              port: 443,
              path: '/v1/uploads',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${destToken}`,
                'Content-Type': 'application/octet-stream',
                'X-Goog-Upload-Protocol': 'raw',
                'X-Goog-Upload-Content-Type': mimeType || 'image/jpeg',
                'Content-Length': buffer.length
              }
            }, (rawRes) => {
              let tokenBody = '';
              rawRes.on('data', c => tokenBody += c);
              rawRes.on('end', () => {
                if (rawRes.statusCode === 200) resolve(tokenBody.trim());
                else reject(new Error(`Fallback buffer upload failed (HTTP ${rawRes.statusCode}): ${tokenBody}`));
              });
            });
            rawReq.on('error', reject);
            rawReq.write(buffer);
            rawReq.end();
          });
        }

      } catch (e) {
        reject(e);
      }
    });

    // Step 2: Finalize Media Item in Account B
    const createPayload = JSON.stringify({
      newMediaItems: [
        {
          description: "Migrated via Google Account Migration Tool",
          simpleMediaItem: {
            uploadToken,
            fileName: fileName || 'photo_migrated.jpg'
          }
        }
      ]
    });

    const createResult = await new Promise((resolve, reject) => {
      const createReq = https.request({
        hostname: 'photoslibrary.googleapis.com',
        port: 443,
        path: '/v1/mediaItems:batchCreate',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${destToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(createPayload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      });
      createReq.on('error', reject);
      createReq.write(createPayload);
      createReq.end();
    });

    return {
      uploadToken,
      createResult
    };
  }
}

