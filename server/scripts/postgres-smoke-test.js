import { initDatabase, getDatabaseBackend, db, closeDatabase } from '../src/db/database.js';
import { AccountRepository } from '../src/repositories/AccountRepository.js';
import { JobRepository } from '../src/repositories/JobRepository.js';
import { ItemRepository } from '../src/repositories/ItemRepository.js';
import { AuditRepository } from '../src/repositories/AuditRepository.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeId(prefix, suffix) {
  return `${prefix}_${suffix}_${Date.now()}`;
}

async function main() {
  if ((process.env.DATABASE_TYPE || '').toLowerCase() !== 'postgres') {
    throw new Error('Set DATABASE_TYPE=postgres before running this smoke test');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the PostgreSQL smoke test');
  }

  console.log('[PG-SMOKE] PostgreSQL backend selected');
  await initDatabase();
  console.log('[PG-SMOKE] Connection successful');
  console.log('[PG-SMOKE] Schema initialization successful');
  console.log(`[PG-SMOKE] Active backend: ${getDatabaseBackend()}`);
  console.log('[PG-SMOKE] TEST schema:idempotent-reinit');
  await closeDatabase();
  await initDatabase();
  console.log('[PG-SMOKE] Idempotent reinitialization successful');

  const prefix = `pgsmoke_${Date.now()}`;
  const sourceId = makeId(prefix, 'source');
  const destId = makeId(prefix, 'dest');
  const jobId = makeId(prefix, 'job');
  const itemId = makeId(prefix, 'item');
  const auditMessage = `Smoke test ${prefix}`;

  console.log('[PG-SMOKE] TEST accounts:create');
  await AccountRepository.save({
    id: sourceId,
    email: `${prefix}.source@example.com`,
    role: 'source',
    scopes: 'scope-a scope-b',
    tokenData: { access_token: `${prefix}.token.source` }
  });
  await AccountRepository.save({
    id: destId,
    email: `${prefix}.dest@example.com`,
    role: 'destination',
    scopes: 'scope-c scope-d',
    tokenData: { access_token: `${prefix}.token.dest` }
  });
  const sourceAccount = await AccountRepository.get(sourceId);
  assert(sourceAccount && sourceAccount.email.includes('source@example.com'), 'Account read-back failed');

  console.log('[PG-SMOKE] TEST jobs:create');
  await JobRepository.create({
    id: jobId,
    serviceType: 'PHOTOS',
    migrationMode: 'SMOKE',
    sourceEmail: sourceAccount.email,
    destEmail: `${prefix}.dest@example.com`,
    status: 'READY',
    totalItems: 1
  });
  const job = await JobRepository.get(jobId);
  assert(job && job.status === 'READY', 'Job read-back failed');
  await JobRepository.updateStatus(jobId, 'RUNNING', { completed_items: 0, failed_items: 0 });
  await JobRepository.incrementCompleted(jobId);
  await JobRepository.incrementFailed(jobId);

  console.log('[PG-SMOKE] TEST migration_items:create');
  await ItemRepository.createBatch([{
    id: itemId,
    job_id: jobId,
    source_item_id: `${prefix}.source.item`,
    source_name: 'smoke-item.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 123,
    item_type: 'PHOTO',
    parent_path: '/',
    source_parent_id: null,
    dest_parent_id: null,
    dest_item_id: null,
    status: 'PENDING',
    fingerprint: `${prefix}.fingerprint`
  }]);
  const items = await ItemRepository.getByJobId(jobId);
  assert(items.length === 1 && items[0].source_name === 'smoke-item.jpg', 'Migration item read-back failed');
  await ItemRepository.updateStatus(itemId, 'COMPLETED', { destItemId: `${prefix}.dest.item` });
  await ItemRepository.updateDestParentId(itemId, `${prefix}.dest.parent`);
  await ItemRepository.updateRetryCount(itemId, 1);

  console.log('[PG-SMOKE] TEST audit:create');
  await AuditRepository.log({
    jobId,
    itemId,
    level: 'INFO',
    eventType: 'PG_SMOKE',
    message: auditMessage
  });
  const auditRows = await AuditRepository.getByJobId(jobId);
  assert(auditRows.length >= 1, 'Audit read-back failed');

  console.log('[PG-SMOKE] TEST persistence:readback');
  const reloadedAccount = await AccountRepository.get(sourceId);
  const reloadedJob = await JobRepository.get(jobId);
  const reloadedItems = await ItemRepository.getByJobId(jobId);
  const reloadedAudit = await AuditRepository.getByJobId(jobId);
  assert(reloadedAccount && reloadedJob && reloadedItems.length === 1 && reloadedAudit.length >= 1, 'Persistence re-read failed');

  console.log('[PG-SMOKE] TEST cleanup');
  await ItemRepository.updateStatus(itemId, 'COMPLETED', { destItemId: `${prefix}.dest.item` });
  await AuditRepository.log({
    jobId,
    itemId,
    level: 'INFO',
    eventType: 'PG_SMOKE_DONE',
    message: `Cleanup for ${prefix}`
  });
  await AccountRepository.delete(sourceId);
  await AccountRepository.delete(destId);
  await db.prepare('DELETE FROM audit_logs WHERE job_id = ?').run(jobId);
  await db.prepare('DELETE FROM migration_items WHERE job_id = ?').run(jobId);
  await db.prepare('DELETE FROM migration_jobs WHERE id = ?').run(jobId);

  await closeDatabase();
  console.log('[PG-SMOKE] Completed successfully');
}

main().catch(err => {
  console.error('[PG-SMOKE] FAILED:', err.message);
  process.exit(1);
});
