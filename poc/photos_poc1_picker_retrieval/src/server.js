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

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Configuration endpoint
  if (pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ clientId: getClientId() }));
    return;
  }

  // Proxy endpoint for Google Photos Picker REST API (avoids any browser CORS restrictions)
  if (pathname.startsWith('/api/proxy/')) {
    const targetPath = pathname.replace('/api/proxy', '');
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
  console.log(`PHOTOS-POC-1 Server running at http://localhost:${PORT}`);
});
