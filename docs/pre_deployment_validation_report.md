# Pre-Deployment Validation Report
# Google Photos Migration — Drive Storage Manager

**Generated:** 2026-08-19  
**Status as of this report:** NOT_READY → see Section 12

---

## 1. Current Architecture Summary

### Google Photos Migration Flow
1. Source account (Account A) creates a Picker session via `POST /api/photos/session`.  
   Scope: `photospicker.mediaitems.readonly`
2. User opens the Google-hosted Picker UI. Media is selected within Google's UI.
3. Frontend polls `GET /api/photos/session/:id` until `mediaItemsSet = true`.
4. Frontend fetches descriptors via `GET /api/photos/mediaItems/:id`.
5. Frontend sends descriptors to `POST /api/photos/jobs`.  
   Backend generates a **composite fingerprint** for each item using `buildPhotoFingerprint()` and persists it in the `fingerprint` column alongside the temporary `baseUrl` in `source_item_id`.
6. `POST /api/jobs/:id/start` starts the job. `JobQueue.startJob()` runs sequentially (required by Photos API to avoid 429 concurrent-write limits).
7. For each item, `PhotosMigrationEngine.processItem()`:  
   a. Downloads bytes into ephemeral RAM using `PhotosService.streamAndUploadMedia()`.  
   b. Uploads to Account B via `photoslibrary.appendonly`.  
   c. Calls `mediaItems:batchCreate` to finalize.  
   d. On success: persists `VERIFIED` + `dest_item_id` to SQLite.
8. On server restart: `JobQueue.init()` resets `PROCESSING` → `PENDING`, sets `RUNNING` jobs to `PAUSED`.

### Error Taxonomy
| Error | Classification | Item State | Job State |
|---|---|---|---|
| HTTP 401 on any request | AUTH_REQUIRED | AUTH_REQUIRED | AUTH_REQUIRED |
| HTTP 403 on SOURCE download stream | Source URL Expired | SOURCE_ACCESS_EXPIRED | RECOVERY_REQUIRED |
| HTTP 429 / 5xx | Transient | Retry w/ backoff | continues |
| Network drop | Transient | Retry w/ backoff | continues |

### Recovery Flow
When job is `RECOVERY_REQUIRED`, user clicks "Renew Source Access". A new Picker session is created. User re-selects items. Frontend posts to `POST /api/photos/resume-recovery`. Backend uses strict fingerprint matching. Only resumes if `canResume = true`.

---

## 2. Phase A — Code Consistency Audit Results

### FINDING A-1 [CRITICAL BUG — NOW FIXED]
**Component:** `PhotosController.js` — `resumeRecovery` function  
**Problem:** The previous implementation of `resumeRecovery` was the **old version** — the correct strict-matching code with `SAFE_MATCH / AMBIGUOUS / UNMATCHED` logic was never persisted to disk. PowerShell string interpolation had silently destroyed all template literal expressions, reducing the fingerprint to an empty string `"||||"`, guaranteeing zero matches. The function was also unconditionally calling `JobQueue.startJob()` regardless of match results, and returning `{matchedCount}` instead of the required structured report.  
**Impact:** Recovery would always fail to match anything, unconditionally start the job with expired URLs, and lie to the frontend claiming success.  
**Fix Applied:** `PhotosController.js` completely rewritten cleanly without relying on PowerShell string interpolation. All logic verified against the spec.

### FINDING A-2 [CRITICAL BUG — NOW FIXED]
**Component:** `PhotosController.js` — `createJob` function  
**Problem:** The `fingerprint` variable was referenced in `dbItems` but was never declared. `buildPhotoFingerprint(it)` was imported but not called. All stored fingerprints would be `undefined` (written as `NULL` by SQLite).  
**Impact:** All fingerprints in the database would be NULL. Recovery matching would never match any item (NULL !== NULL in SQLite equality checks), making the entire fingerprint system inoperable.  
**Fix Applied:** `createJob` now calls `buildPhotoFingerprint(it)` for every item and assigns the result to the `fingerprint` variable before constructing `dbItems`.

### FINDING A-3 [SERIOUS BUG — NOW FIXED]
**Component:** `ItemRepository.getPendingItems()`  
**Problem:** SQL query was `status != 'COMPLETED'`, which means `VERIFIED` items were returned as pending and would be re-queued on every resume.  
**Impact:** Items already confirmed as uploaded to Account B would be processed again on every job start/retry/recovery. This is the primary duplicate-upload risk vector.  
**Fix Applied:** Query changed to `status NOT IN ('COMPLETED','VERIFIED')`.

### FINDING A-4 [BUG — NOW FIXED]
**Component:** `routes/index.js`  
**Problem:** Route was registered as `/photos/create-job` but `api.js` was calling `/api/photos/jobs`. Additionally, the `/photos/resume-recovery` route was completely absent.  
**Impact:** All Photos job creation calls from the frontend would silently 404. The recovery endpoint could never be reached.  
**Fix Applied:** Route renamed to `/photos/jobs`. Route `/photos/resume-recovery` added.

### REMAINING AUDIT RESULTS (PASS)

| Check | Result |
|---|---|
| `buildPhotoFingerprint()` is the ONLY fingerprint generation logic | **PASS** — used in both createJob and resumeRecovery |
| Initial job creation and recovery use the same fingerprint function | **PASS** — both import from `fingerprintUtils.js` |
| Fields normalized identically in both directions | **PASS** — filename trimmed, mimeType lowercased, createTime → ISO, width/height → string with '0' fallback |
| `source_item_id` semantics consistent | **PASS** — for Photos jobs this column stores the temporary `baseUrl`. Documented in code comments. |
| VERIFIED items cannot re-enter execution queue | **PASS** (after Fix A-3) |
| COMPLETED and VERIFIED semantics consistent | **PASS** — both excluded by `getPendingItems`, both excluded from recovery `unfinishedItems` |
| PROCESSING cannot get permanently stuck after crash | **PASS** — `JobQueue.init()` resets all PROCESSING → PENDING on startup |
| `JobQueue.init()` handles interrupted jobs correctly | **PASS** — RUNNING → PAUSED, PROCESSING → PENDING |
| RECOVERY_REQUIRED jobs cannot be accidentally resumed | **PASS** — `resumeRecovery` validates job status; `canResume` gate enforced server-side |
| `canResume` is enforced by backend, not frontend | **PASS** — `JobQueue.startJob()` is only called inside `resumeRecovery` when `canResume === true` |
| Ambiguous matches cannot update source URLs | **PASS** — ambiguous path increments counter only, no DB write |
| Unmatched Picker items cannot create new DB rows | **PASS** — unmatched path increments counter only |
| Duplicate Picker item cannot update same DB item twice | **PASS** — matched item is spliced from `unfinishedPool` immediately |
| Partial recovery selection cannot transition job to RUNNING | **PASS** — `requiredRemaining > 0` makes `canResume = false` |
| Verified item selected again cannot overwrite state | **PASS** — verified items are caught by `verifiedItems.some()` and only increment `alreadyVerified` |
| HTTP 401 and source-side HTTP 403 classified correctly | **PASS** — 403 only classified as SOURCE_ACCESS_EXPIRED when `err.source === 'SOURCE_DOWNLOAD'`; 401 is AUTH_REQUIRED |
| `dbIncrementRetry` async pattern | **NOTE** — this uses fire-and-forget dynamic import. In practice the retry_count update is not guaranteed to complete before the next attempt reads it. Low-severity race; does not affect safety. |

---

## 3. Phase B — Test Matrix

### GROUP 1 — NORMAL MIGRATION

| ID | Scenario | Initial State | Action | Expected Item States | Expected Job State | DB Result | UI Result | Pass Criteria |
|---|---|---|---|---|---|---|---|---|
| N1 | 5 small photos, normal | No existing job | Pick 5 photos, create job, start | All → VERIFIED | COMPLETED | 5 rows with fingerprint, dest_item_id set, status=VERIFIED | Progress 5/5, Completed badge | dest_item_id non-null for all 5 |
| N2 | Mixed photos + videos | No existing job | Pick 2 photos + 2 videos | All → VERIFIED | COMPLETED | item_type correct (VIDEO/PHOTO), =dv used for video download | All succeed | Videos arrive at full size (not 75KB thumbnail) |

### GROUP 2 — RESTART RECOVERY

| ID | Scenario | Initial State | Action | Expected Item States | Expected Job State | DB Result | UI Result | Pass Criteria |
|---|---|---|---|---|---|---|---|---|
| R1 | Kill backend mid-job | 3 VERIFIED, 2 PROCESSING | Kill server process, restart | 3=VERIFIED, 2=PENDING (reset from PROCESSING) | PAUSED | No PROCESSING rows remain | PAUSED badge; Resume button visible | VERIFIED items unchanged; no duplicate upload on resume |
| R2 | Crash after batchCreate but before VERIFIED write | 1 item completed at Google but DB not updated | Kill server between batchCreate response and `updateStatus(VERIFIED)` | Item stays PENDING | PAUSED | DB has no dest_item_id for that item | Resume requeues it | **DUPLICATE RISK EXISTS** — see Section 8 |

### GROUP 3 — TRANSIENT FAILURES

| ID | Scenario | Action | Expected | Pass Criteria |
|---|---|---|---|---|
| T1 | Network drop during source download | Disconnect during download stream | Error thrown, retry backoff 1×2.5s, 2×5s, 3×7.5s | Item retries up to maxRetries=3, then FAILED |
| T2 | Network drop during destination upload | Disconnect during upload | Error thrown, retry with backoff | Same retry behavior; no partial upload stuck open |
| T3 | Simulate retryable server failure | N/A — no controlled test mechanism without real API mock | N/A | N/A |
| T4 | Verify retry does not create duplicate upload | Retry after failed batchCreate | If upload token succeeded but batchCreate failed: retry creates new upload token | **DUPLICATE RISK** if upload token was already partially accepted — see Section 8 |

### GROUP 4 — AUTHENTICATION RECOVERY

| ID | Scenario | Expected | Pass Criteria |
|---|---|---|---|
| A1 | Disconnect/revoke Account A token | Item → AUTH_REQUIRED; job → AUTH_REQUIRED | No retry loop; UI shows reconnect prompt |
| A2 | Disconnect/revoke Account B token | Same AUTH_REQUIRED path (401 on upload step) | Distinguishable at item level only if the 401 surfaces through PhotosService; currently both A and B 401s produce AUTH_REQUIRED |
| A3 | Reconnect and retry | Items previously AUTH_REQUIRED → reset to PENDING on retryJob | VERIFIED items skipped; only remaining items processed |

### GROUP 5 — SOURCE URL EXPIRY

| ID | Scenario | Expected | Pass Criteria |
|---|---|---|---|
| E1 | Source baseUrl expired (403 on download) | Item → SOURCE_ACCESS_EXPIRED; state.recoveryRequired = true; loop stops | Job becomes RECOVERY_REQUIRED; expired URL not retried |
| E2 | Confirm 403 is not misclassified | Only `err.source === 'SOURCE_DOWNLOAD'` triggers SOURCE_ACCESS_EXPIRED | A 403 from the destination upload would fall through to generic FAILED path |

### GROUP 6 — FINGERPRINT RECOVERY

| ID | Scenario | Expected | Pass Criteria |
|---|---|---|---|
| F1 | Same filename, different createTime | Distinct ISO timestamps → distinct fingerprints | 1-to-1 safe match |
| F2 | Same filename + dimensions, different createTime | Same as F1 | 1-to-1 safe match |
| F3 | Two unfinished DB items with identical fingerprint | AMBIGUOUS; no URL update; canResume=false | DB unchanged for those items |
| F4 | Select only 9 of 10 required items | requiredRemaining=1, canResume=false | Job stays RECOVERY_REQUIRED |
| F5 | Select all 10 required items | requiredRemaining=0, ambiguous=0, canResume=true | Job resumes |
| F6 | Superset selection (required + verified + unrelated) | Required matched, verified counted as alreadyVerified, unrelated = unmatched; no new DB rows | canResume=true only if all required matched |
| F7 | Same Picker item submitted twice | Second submission finds 0 candidates (item already removed from pool) → unmatched++ | DB item only updated once |

### GROUP 7 — EXACTLY-ONCE / CRASH WINDOW ANALYSIS

See Section 8.

---

## 8. Duplicate-Upload Analysis and Crash Window

### Operation Sequence
```
1. source download into RAM       ← no Google state created yet
2. upload token obtained          ← Google has bytes, no media item yet
3. mediaItems:batchCreate called  ← Google creates destination media item
4. batchCreate response received  ← dest_item_id known to process
5. ItemRepository.updateStatus(VERIFIED, destItemId)  ← persisted to SQLite
6. JobRepository.incrementCompleted()
```

### Crash Windows

**Window A: Crash between step 1 and 2**  
→ No Google state created. On restart, item is PENDING (reset from PROCESSING). Retry is fully safe. **No duplicate risk.**

**Window B: Crash between step 2 and 3 (upload token obtained, batchCreate not yet called)**  
→ Bytes were uploaded to Google staging. Google staging tokens expire (they are not permanent). On restart, item is PENDING. Retry creates a new upload token and calls batchCreate fresh. **No permanent duplicate risk.** Google staging is temporary.

**Window C: Crash between step 3 and 5 (batchCreate succeeded at Google, but DB not yet updated to VERIFIED)**  
→ Google has already created the destination media item. Local DB still shows item as PROCESSING → reset to PENDING on restart → item will be retried → **batchCreate will be called again** → **a second copy of the media item will be created in Account B.**  
→ **THIS IS AN UNAVOIDABLE DUPLICATE RISK.** The `photoslibrary.appendonly` scope does not permit reading Account B's library to check for prior existence. There is no idempotency key available in the current Photos Library API batchCreate call. This crash window is narrow (milliseconds between response and DB write) but exists.

**Window D: Crash during step 5 itself (DB write fails)**  
Same as Window C.

### Honest Classification
The system is **not strictly exactly-once** for Google Photos. It is **at-most-once in normal operation** and **at-most-twice in the crash window between batchCreate success and VERIFIED persistence**. This is a fundamental limitation of the Google Photos Library API with the `appendonly` scope and cannot be fixed without adding the `photoslibrary.readonly` scope (which is prohibited) or an out-of-band deduplication check.

**Recommendation:** For a real migration, the crash window risk is low but real. If you notice a duplicate in Account B after a crash, it must be manually removed.

---

## 9. Known Limitations

1. **Duplicate on crash window C** — See Section 8. Cannot be eliminated without prohibited scopes.
2. **AUTH_REQUIRED does not distinguish Account A vs Account B** — Both result in the same `AUTH_REQUIRED` state. The error message text differs but the job state does not.
3. **`dbIncrementRetry` is fire-and-forget** — Uses async dynamic import. The retry_count may not be read correctly on the next iteration. Low-severity but means retry_count in the DB can lag by 1.
4. **No fingerprint when `createTime` is absent** — Items without `createTime` all get `no_date` in the fingerprint. If you have multiple files with the same name and no metadata timestamp (e.g., old screenshots), their fingerprints may collide, triggering AMBIGUOUS. This is the correct safe behavior — it prevents wrong matches — but those items would require manual intervention.
5. **Recovery session uses Account A's current token** — The recovery Picker session is created using `AuthService.getSourceToken()`. If Account A's token is also expired, the recovery session creation will fail with 401. The user must first refresh Account A before performing recovery.
6. **Polling in `handleRecovery` uses `alert()` as gate** — The "click OK after selecting" alert is fragile UX. If the user clicks OK before finishing selection, polling may time out.

---

## 10. Remaining Blockers (Before Large Migration)

| Blocker | Severity | Mitigation |
|---|---|---|
| Crash window duplicate risk (Section 8) | Medium | Narrow window; accept the limitation; manually check Account B for duplicates after any crash |
| No test against real large batch yet | High | Run 20-photo controlled test first |
| Recovery fingerprints only work if createTime is populated | Medium | Verify your actual photos have createTime in the Picker descriptor before running large job |

---

## 11. Files Modified in This Session

| File | Change |
|---|---|
| `server/src/controllers/PhotosController.js` | **Completely rewritten** — fixed createJob fingerprint, replaced resumeRecovery with correct strict-matching logic |
| `server/src/repositories/ItemRepository.js` | `getPendingItems` now excludes `VERIFIED` in addition to `COMPLETED` |
| `server/src/routes/index.js` | `/photos/create-job` renamed to `/photos/jobs`; `/photos/resume-recovery` added |
| `server/src/utils/fingerprintUtils.js` | Created (previous session) — verified correct |
| `client/dist/` | Rebuilt |

---

## 12. Final Classification

**CLASSIFICATION: NOT_READY**

**Reason:** The audit discovered that the two most critical new features — fingerprint generation during job creation (BUG A-2) and strict recovery matching (BUG A-1) — were both non-functional in the previous deployed state due to silent string interpolation failures during code generation. The fixes have now been applied and the build is clean, but the system has **not yet been tested against real API responses**.

---

## Recommended Pre-Migration Testing Strategy

Run these in strict order before touching your full library:

### Step 1 — Smoke Test (5 items)
Pick 5 photos using the Picker. Start migration. Verify all 5 reach `VERIFIED`. Check Account B.

### Step 2 — Restart Test (5 items)
Start a 5-photo job. After 2-3 succeed, kill the Node.js process. Restart. Confirm the first 3 are still `VERIFIED`. Click Resume. Confirm remaining 2 complete. Check Account B for duplicates.

### Step 3 — Recovery Test (10 items)
Start a 10-photo job. After a few succeed, manually set one item's `source_item_id` to a garbage URL in SQLite, and one item to `SOURCE_ACCESS_EXPIRED` status, then set the job to `RECOVERY_REQUIRED`. Click "Renew Source Access". Select the correct items. Verify the structured report shows correct counts. Verify `canResume` behavior.

### Step 4 — Fingerprint Collision Test
In SQLite, manually set two unfinished items to the same `fingerprint`. Run recovery. Verify both are reported as `AMBIGUOUS` and no URL is updated.

### Step 5 — Medium Batch (50–100 items, ~500MB)
Only after Steps 1–4 pass. Run a medium batch. Monitor RAM usage, duration, and check for duplicates in Account B.

### Step 6 — Large Batch (only after Step 5 passes cleanly)
Migrate a larger subset of your library. Do not attempt the full library in a single job on the first large run.
