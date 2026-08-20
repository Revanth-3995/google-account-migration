import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const CANDIDATE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function loadLocalConfig() {
  const credentialsPath = path.join(ROOT_DIR, 'credentials.json');
  const pickerConfigPath = path.join(ROOT_DIR, 'picker-config.json');

  let clientId = '';
  let apiKey = '';
  const setupErrors = [];

  if (fs.existsSync(credentialsPath)) {
    try {
      const raw = fs.readFileSync(credentialsPath, 'utf8');
      const data = JSON.parse(raw);
      clientId = data.web?.client_id || data.installed?.client_id || data.client_id || '';
      if (!clientId) {
        setupErrors.push('credentials.json is present but missing "web.client_id".');
      }
    } catch (err) {
      setupErrors.push(`Failed to parse credentials.json: ${err.message}`);
    }
  } else {
    setupErrors.push('Missing credentials.json.');
  }

  if (fs.existsSync(pickerConfigPath)) {
    try {
      const raw = fs.readFileSync(pickerConfigPath, 'utf8');
      const data = JSON.parse(raw);
      apiKey = data.apiKey || data.api_key || '';
      if (!apiKey) {
        setupErrors.push('picker-config.json is missing "apiKey".');
      }
    } catch (err) {
      setupErrors.push(`Failed to parse picker-config.json: ${err.message}`);
    }
  } else {
    setupErrors.push('Missing picker-config.json.');
  }

  return {
    hasCredentials: fs.existsSync(credentialsPath),
    hasPickerConfig: fs.existsSync(pickerConfigPath),
    clientId: clientId.trim(),
    apiKey: apiKey.trim(),
    setupErrors,
    candidateScope: CANDIDATE_SCOPE
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/config') {
    const config = loadLocalConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(config));
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`POC-2 Drive Folder Hierarchy Test Runner: http://localhost:${PORT}`);
  console.log(`Candidate Scope: ${CANDIDATE_SCOPE}`);
  console.log(`================================================================`);
});
