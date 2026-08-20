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

// Helper: load and validate local configuration files
function loadLocalConfig() {
  const credentialsPath = path.join(ROOT_DIR, 'credentials.json');
  const pickerConfigPath = path.join(ROOT_DIR, 'picker-config.json');

  let clientId = '';
  let apiKey = '';
  const setupErrors = [];

  // 1. Parse credentials.json (downloaded OAuth Web Client credentials from Google Cloud Console)
  if (fs.existsSync(credentialsPath)) {
    try {
      const raw = fs.readFileSync(credentialsPath, 'utf8');
      const data = JSON.parse(raw);
      clientId = data.web?.client_id || data.installed?.client_id || data.client_id || '';
      if (!clientId) {
        setupErrors.push('credentials.json is present but missing "web.client_id" (OAuth Web Client ID).');
      }
    } catch (err) {
      setupErrors.push(`Failed to parse credentials.json: ${err.message}`);
    }
  } else {
    setupErrors.push('Missing credentials.json. Please save your downloaded OAuth Web Client JSON as credentials.json.');
  }

  // 2. Parse picker-config.json (contains only the Google Picker API Key)
  if (fs.existsSync(pickerConfigPath)) {
    try {
      const raw = fs.readFileSync(pickerConfigPath, 'utf8');
      const data = JSON.parse(raw);
      apiKey = data.apiKey || data.api_key || '';
      if (!apiKey) {
        setupErrors.push('picker-config.json is present but missing the "apiKey" property.');
      }
    } catch (err) {
      setupErrors.push(`Failed to parse picker-config.json: ${err.message}`);
    }
  } else {
    setupErrors.push('Missing picker-config.json. Please create picker-config.json with { "apiKey": "YOUR_API_KEY" }.');
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

  // Dynamic config endpoint for browser harness
  // Exposes ONLY clientId, apiKey, candidateScope, and setupErrors.
  // NEVER exposes client_secret or full credentials.json contents.
  if (url.pathname === '/api/config') {
    const config = loadLocalConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(config));
  }

  // Static file serving
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // Security: prevent directory traversal
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
  console.log(`POC-1 Local Browser Test Harness running at: http://localhost:${PORT}`);
  console.log(`OAuth Flow: Google Identity Services (GIS) Token Client (In-Browser)`);
  console.log(`Config Source 1: credentials.json (OAuth Web Client)`);
  console.log(`Config Source 2: picker-config.json (Picker API Key)`);
  console.log(`Client Secret Required/Used: NO`);
  console.log(`Authorized Scope: ${CANDIDATE_SCOPE}`);
  console.log(`================================================================`);

  const initialConfig = loadLocalConfig();
  if (initialConfig.setupErrors.length > 0) {
    console.log(`\n[Setup Status Notice]:`);
    initialConfig.setupErrors.forEach(err => console.log(` - ${err}`));
    console.log(`\nPlease add the required files and refresh http://localhost:${PORT}\n`);
  } else {
    console.log(`\n[Setup Status]: All configuration files detected successfully.\n`);
  }
});
