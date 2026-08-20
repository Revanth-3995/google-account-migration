import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDatabase, getDatabaseBackend } from './db/database.js';
import { apiRouter } from './routes/index.js';
import { JobQueue } from './jobs/JobQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Serve frontend dist only when explicitly enabled.
// In normal development, the live UI should come from the Vite dev server on port 3000.
if (process.env.SERVE_CLIENT_DIST === '1') {
  const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(CLIENT_DIST));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) res.status(404).send('Google Account Migration Server Running. Frontend is running on Vite dev server.');
    });
  });
} else {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(404).send('Google Account Migration API Running. Frontend is running on the Vite dev server at http://localhost:3000.');
  });
}

async function start() {
  await initDatabase();
  console.log(`[Server] Database backend active: ${getDatabaseBackend()}`);
  await JobQueue.init();

  app.listen(config.port, () => {
    console.log(`[Server] Google Account Migration API running at http://localhost:${config.port}`);
  });
}

start().catch(err => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});

