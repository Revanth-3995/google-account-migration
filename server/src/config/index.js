import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../..');
const SERVER_DIR = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

function loadCredentials() {
  const envClientId = process.env.GOOGLE_CLIENT_ID || '';
  const envProjectId = process.env.GOOGLE_PROJECT_ID || 'drive-storage-manager-505102';
  const envAuthUri = process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth';
  const envTokenUri = process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token';
  const envApiKey = process.env.GOOGLE_API_KEY || '';
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (envClientId) {
    return {
      clientId: envClientId,
      projectId: envProjectId,
      authUri: envAuthUri,
      tokenUri: envTokenUri,
      apiKey: envApiKey,
      clientSecret: envClientSecret
    };
  }

  const possiblePaths = [
    path.join(SERVER_DIR, 'credentials.json'),
    path.join(ROOT_DIR, 'poc/photos_poc2_destination_upload/credentials.json'),
    path.join(ROOT_DIR, 'poc/photos_poc1_picker_retrieval/credentials.json'),
    path.join(ROOT_DIR, 'poc/poc1_drive_share_copy/credentials.json')
  ];

  let apiKey = envApiKey || '';
  try {
    const pkPath = process.env.GOOGLE_PICKER_CONFIG_PATH || path.join(ROOT_DIR, 'poc/poc1_drive_share_copy/picker-config.json');
    if (fs.existsSync(pkPath)) {
      apiKey = JSON.parse(fs.readFileSync(pkPath, 'utf8')).apiKey || apiKey;
    }
  } catch (e) {}

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const web = data.web || data.installed;
        if (web && web.client_id) {
          return {
            clientId: web.client_id,
            projectId: web.project_id || envProjectId,
            authUri: web.auth_uri || envAuthUri,
            tokenUri: web.token_uri || envTokenUri,
            apiKey,
            clientSecret: web.client_secret || envClientSecret
          };
        }
      } catch (e) {
        console.error('Error reading credentials from', p, e.message);
      }
    }
  }

  return {
    clientId: '',
    projectId: envProjectId,
    authUri: envAuthUri,
    tokenUri: envTokenUri,
    apiKey,
    clientSecret: envClientSecret
  };
}

export const config = {
  port: process.env.PORT || 3000,
  databaseType: (process.env.DATABASE_TYPE || 'sqlite').toLowerCase(),
  dbPath: process.env.DATABASE_PATH || path.join(SERVER_DIR, 'data/migration.db'),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
  google: loadCredentials(),
  concurrency: 2
};
