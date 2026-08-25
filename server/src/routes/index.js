import express from 'express';
import { AccountController } from '../controllers/AccountController.js';
import { DriveController } from '../controllers/DriveController.js';
import { PhotosController } from '../controllers/PhotosController.js';
import { JobController } from '../controllers/JobController.js';
import { AuditController } from '../controllers/AuditController.js';
import { EventBroadcaster } from '../utils/eventBroadcaster.js';
import { config } from '../config/index.js';

export const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Config
apiRouter.get('/config', (req, res) => {
  res.json({
    clientId: config.google.clientId
  });
});

// Accounts
apiRouter.get('/accounts', AccountController.getAccounts);
apiRouter.post('/accounts', AccountController.saveAccount);
apiRouter.delete('/accounts/:id', AccountController.deleteAccount);

// Drive
apiRouter.post('/drive/manifest', DriveController.discoverManifest);
apiRouter.post('/drive/create-job', DriveController.createJob);

// Photos
apiRouter.post('/photos/session', PhotosController.createSession);
apiRouter.get('/photos/session/:id', PhotosController.getSession);
apiRouter.get('/photos/mediaItems/:id', PhotosController.getMediaItems);
apiRouter.delete('/photos/session/:id', PhotosController.deleteSession);
apiRouter.post('/photos/jobs', PhotosController.createJob);
apiRouter.post('/photos/resume-recovery', PhotosController.resumeRecovery);

// Jobs
apiRouter.get('/jobs', JobController.getAllJobs);
apiRouter.get('/jobs/:id', JobController.getJobDetails);
apiRouter.post('/jobs/:id/start', JobController.startJob);
apiRouter.post('/jobs/:id/retry', JobController.retryJob);
apiRouter.post('/jobs/:id/pause', JobController.pauseJob);
apiRouter.post('/jobs/:id/cancel', JobController.cancelJob);

// Audit
apiRouter.get('/audit', AuditController.getRecentLogs);

// Real-Time SSE Stream
apiRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  EventBroadcaster.addClient(res);
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ message: 'SSE Stream Active' })}\n\n`);

  req.on('close', () => {
    EventBroadcaster.removeClient(res);
  });
});


