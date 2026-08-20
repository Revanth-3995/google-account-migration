export const api = {
  async getConfig() {
    const res = await fetch('/api/config');
    return res.json();
  },

  async getAccounts() {
    const res = await fetch('/api/accounts');
    return res.json();
  },

  async saveAccount(account) {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
    return res.json();
  },

  async deleteAccount(id) {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async discoverDriveManifest(rootFolderId, rootFolderName) {
    const res = await fetch('/api/drive/manifest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootFolderId, rootFolderName })
    });
    return res.json();
  },

  async createDriveJob(migrationMode, items) {
    const res = await fetch('/api/drive/create-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ migrationMode, items })
    });
    return res.json();
  },

  async createPhotosSession() {
    const res = await fetch('/api/photos/session', { method: 'POST' });
    return res.json();
  },

  async getPhotosSession(sessionId) {
    const res = await fetch(`/api/photos/session/${sessionId}`);
    return res.json();
  },

  async getPhotosMediaItems(sessionId) {
    const res = await fetch(`/api/photos/mediaItems/${sessionId}`);
    return res.json();
  },

  async deletePhotosSession(sessionId) {
    const res = await fetch(`/api/photos/session/${sessionId}`, { method: 'DELETE' });
    return res.json();
  },

  async resumeRecoveryPhotos(jobId, items) {
    const res = await fetch('/api/photos/resume-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, items })
    });
    return res.json();
  },

  async createPhotosJob(items) {
    const res = await fetch('/api/photos/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return res.json();
  },

  async getJobs() {
    const res = await fetch('/api/jobs');
    return res.json();
  },

  async getJobDetails(id) {
    const res = await fetch(`/api/jobs/${id}`);
    return res.json();
  },

  async retryJob(id) {
    const res = await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
    return res.json();
  },

  async startJob(id) {
    const res = await fetch(`/api/jobs/${id}/start`, { method: 'POST' });
    return res.json();
  },

  async pauseJob(id) {
    const res = await fetch(`/api/jobs/${id}/pause`, { method: 'POST' });
    return res.json();
  },

  async cancelJob(id) {
    const res = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    return res.json();
  },

  async getAuditLogs(limit = 100) {
    const res = await fetch(`/api/audit?limit=${limit}`);
    return res.json();
  }
};

