import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

function getClientId() {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      const web = data.web || data.installed;
      if (web && web.client_id) return web.client_id;
    }
  } catch (err) {
    console.error('Error reading credentials.json:', err.message);
  }
  return '';
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Configuration endpoint
  if (pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ clientId: getClientId() }));
    return;
  }

  // Proxy for Google Photos Picker REST API (Account A)
  if (pathname.startsWith('/api/proxy/photos-picker/')) {
    const targetPath = pathname.replace('/api/proxy/photos-picker', '');
    const authHeader = req.headers['authorization'] || '';
    
    const options = {
      hostname: 'photospicker.googleapis.com',
      port: 443,
      path: targetPath + urlObj.search,
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // Proxy for Google Photos Library REST API (Account B)
  if (pathname.startsWith('/api/proxy/photos-library/')) {
    const targetPath = pathname.replace('/api/proxy/photos-library', '');
    const authHeader = req.headers['authorization'] || '';
    
    const options = {
      hostname: 'photoslibrary.googleapis.com',
      port: 443,
      path: targetPath + urlObj.search,
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': req.headers['content-type'] || 'application/json'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // In-Memory Relay Endpoint (Streams media from Account A baseUrl -> RAM -> Account B uploads -> batchCreate)
  if (pathname === '/api/relay/stream-photo' && req.method === 'POST') {
    const startTime = Date.now();
    try {
      const payload = await parseJsonBody(req);
      const { downloadUrl, fileName, mimeType, accountAToken, accountBToken } = payload;

      if (!downloadUrl || !accountAToken || !accountBToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing downloadUrl, accountAToken, or accountBToken' }));
        return;
      }

      // Step 1: Download full bytes from Account A baseUrl into RAM
      const downloadStart = Date.now();
      const imageBuffer = await new Promise((resolve, reject) => {
        const fetchReq = https.get(downloadUrl, {
          headers: { 'Authorization': `Bearer ${accountAToken}` }
        }, (fetchRes) => {
          if (fetchRes.statusCode !== 200) {
            return reject(new Error(`Download failed with HTTP ${fetchRes.statusCode}`));
          }
          const chunks = [];
          fetchRes.on('data', c => chunks.push(c));
          fetchRes.on('end', () => resolve(Buffer.concat(chunks)));
        });
        fetchReq.on('error', reject);
      });
      const downloadDuration = Date.now() - downloadStart;

      // In-memory inspection (0 disk bytes)
      const byteSize = imageBuffer.length;
      const isJpeg = imageBuffer.length > 2 && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
      const hasExif = imageBuffer.indexOf(Buffer.from('Exif\0\0')) !== -1;

      // Step 2: Upload raw bytes to Account B (POST https://photoslibrary.googleapis.com/v1/uploads)
      const uploadStart = Date.now();
      const uploadToken = await new Promise((resolve, reject) => {
        const uploadReq = https.request({
          hostname: 'photoslibrary.googleapis.com',
          port: 443,
          path: '/v1/uploads',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accountBToken}`,
            'Content-Type': 'application/octet-stream',
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-Content-Type': mimeType || 'image/jpeg',
            'Content-Length': byteSize
          }
        }, (uploadRes) => {
          let tokenBody = '';
          uploadRes.on('data', c => { tokenBody += c; });
          uploadRes.on('end', () => {
            if (uploadRes.statusCode === 200) {
              resolve(tokenBody.trim());
            } else {
              reject(new Error(`Upload failed with HTTP ${uploadRes.statusCode}: ${tokenBody}`));
            }
          });
        });
        uploadReq.on('error', reject);
        uploadReq.write(imageBuffer);
        uploadReq.end();
      });
      const uploadDuration = Date.now() - uploadStart;

      // Step 3: Call batchCreate on Account B
      const createStart = Date.now();
      const batchCreatePayload = JSON.stringify({
        newMediaItems: [
          {
            description: "Migrated via In-Memory Relay (PHOTOS-POC-2)",
            simpleMediaItem: {
              uploadToken: uploadToken,
              fileName: fileName || 'migrated_photo.jpg'
            }
          }
        ]
      });

      const batchCreateResult = await new Promise((resolve, reject) => {
        const createReq = https.request({
          hostname: 'photoslibrary.googleapis.com',
          port: 443,
          path: '/v1/mediaItems:batchCreate',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accountBToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(batchCreatePayload)
          }
        }, (createRes) => {
          let createBody = '';
          createRes.on('data', c => { createBody += c; });
          createRes.on('end', () => {
            try {
              resolve({ statusCode: createRes.statusCode, data: JSON.parse(createBody) });
            } catch (e) {
              resolve({ statusCode: createRes.statusCode, raw: createBody });
            }
          });
        });
        createReq.on('error', reject);
        createReq.write(batchCreatePayload);
        createReq.end();
      });
      const createDuration = Date.now() - createStart;
      const totalDuration = Date.now() - startTime;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        byteSize,
        byteSizeFormatted: `${(byteSize / 1024).toFixed(2)} KB (${byteSize} bytes)`,
        isJpeg,
        hasExif,
        downloadDuration: `${downloadDuration} ms`,
        uploadDuration: `${uploadDuration} ms`,
        createDuration: `${createDuration} ms`,
        totalDuration: `${totalDuration} ms`,
        uploadTokenLength: uploadToken.length,
        batchCreateResult,
        diskBytesWritten: 0,
        relayType: 'Ephemeral In-Memory Stream'
      }));

    } catch (err) {
      console.error('Relay error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, stack: err.stack }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  if (extname === '.js') contentType = 'text/javascript';
  if (extname === '.css') contentType = 'text/css';
  if (extname === '.json') contentType = 'application/json';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`PHOTOS-POC-2 Server running at http://localhost:${PORT}`);
});
