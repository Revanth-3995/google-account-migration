# POC Execution Plan — Google Account Migration Tool

**Project:** Google Account Migration Tool  
**Version:** 1.0 — Prompt 3 Output  
**Date:** 2026-08-17  
**Status:** PLAN ONLY. Not yet approved. No POC has been executed.

---

> [!CAUTION]
> This document is a **plan only**. Nothing in this document has been executed.
> No Google Cloud project has been created. No OAuth credentials have been created.
> No Google APIs have been enabled. No Google account has been authenticated.
> No API has been called. No application code has been written.
> No test data has been created or accessed.
> Execution of any POC requires explicit approval per the gates defined in the
> **POC Approval Gates** section at the end of this document.

> [!IMPORTANT]
> All POC experiments must use **synthetic, disposable test data only**. No real
> personal files, photos, or data from any real personal Google account may ever
> be used in any POC experiment. Test accounts must be created solely for this
> purpose and discarded after use.

> [!NOTE]
> **POC Cleanup Principle:** Any deletion or revocation during POC cleanup is performed
> manually by the developer / test-account owner through Google's UI or separately approved
> manual test cleanup steps. It is not evidence or an implication that the future
> application will have automatic deletion capability.

---

## POC Index

| POC ID | Name | Priority | Architecture Question |
|---|---|---|---|
| POC-1 | Drive Picker + Share + Copy scope test | **P0** | Does `drive.file` scope work end-to-end for the share-then-copy flow? |
| POC-2 | Drive Picker + Ownership Transfer scope test | **P0** | Does `drive.file` scope work end-to-end for the ownership transfer flow? |
| POC-3 | Photos Picker API scope classification and basic upload | **P0** | What are the real scope tiers? Is the Photos architecture viable? |
| POC-4 | Google-native file fidelity via `files.copy` | **P1** | Does `files.copy` produce acceptable results for Docs, Sheets, Slides? |
| POC-5 | Photos EXIF and metadata preservation | **P1** | Does EXIF data survive the download-then-upload pass-through? |
| POC-6 | Photos video transfer and processing status | **P1** | Do videos transfer correctly? What is the processing delay? |
| POC-7 | Large file streaming — memory, timeout, resumability | **P2** | Can we stream large files without persistent byte storage at realistic sizes? |
| POC-8 | Duplicate prevention mechanism | **P2** | How do we detect and prevent duplicate uploads in a failed-and-retried migration? |

---

## POC-1 — Drive Picker + Share + Copy Scope Test

### Priority
**P0 — Architecture blocker**

### Exact Question Being Tested
Does the complete Drive share-then-copy migration flow work using **only `drive.file` scope**
(Non-sensitive), when the source file was selected via the Google Drive Picker?

Specifically:
1. Can the source account (Account A) call `permissions.create` on a file that was opened
   via the Drive Picker, using only `drive.file` scope?
2. Can the destination account (Account B) call `files.copy` on that shared file ID,
   using only `drive.file` scope?
3. Does the resulting copy end up owned by Account B with correct content?

### Why This POC Matters
This is the primary proposed migration mechanism for Drive binary files. The entire
Drive architecture is designed around the Non-sensitive `drive.file` scope. If
`permissions.create` or `files.copy` require a broader Restricted scope for
Picker-selected files, the architecture must change before any implementation begins.
This POC either confirms the architecture or identifies the scope escalation required.

### Related Open Questions
- **OQ-D-01** — `files.copy` cross-account server-side copy behavior
- **OQ-D-02** — Minimum Drive scopes for our use case
- **OQ-D-06** — OAuth app verification tier and process
- **OQ-D-05** — Folder traversal model (partially answered here)
- **OQ-D-OT-01-SCOPE** — Whether permission methods work under `drive.file` for Picker-selected files

### Preconditions
- POC approval gate has been passed (see Approval Gates section).
- Google Cloud project has been created (separate approval step).
- OAuth credentials have been created for a test application (separate approval step).
- Drive API has been enabled for the test project.
- Two disposable test Google accounts exist.
- One synthetic test file has been created in Account A's Drive (see Test Data).

### Test Accounts
- **Account A (source):** A newly created disposable `@gmail.com` account, used only
  for this POC. Contains only the synthetic test file defined below.
  No real personal data in any form.
- **Account B (destination):** A second newly created disposable `@gmail.com` account,
  used only for this POC. Starts with an empty Drive.
- Both accounts must be added as test users in the OAuth consent screen before any
  OAuth flow is attempted.

### Test Data
- **File 1:** A plain text file (`poc1_test_file.txt`) containing the string
  `"POC-1 test content. Created: YYYY-MM-DD. No personal data."` — created
  manually in Account A's Drive before the POC begins.
- No other files. No photos. No sensitive content of any kind.

### Proposed Google APIs
- **Google Drive API v3** — NOT YET ENABLED
- **Google Drive Picker API** (JavaScript) — NOT YET ENABLED

### Proposed OAuth Scopes

**For Account A (source):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | ⚠️ Candidate — Non-sensitive per documentation; actual behavior in POC context unverified | Primary candidate for both Picker access and `permissions.create` |

**For Account B (destination):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | ⚠️ Candidate — same classification; `files.copy` scope requirement is the question | Primary candidate for `files.copy` |

> [!IMPORTANT]
> Do NOT request `drive.readonly`, `drive.metadata.readonly`, or `drive` scopes
> in this POC. The POC must start with `drive.file` only. If `drive.file` fails,
> the Scope Escalation Rule below applies.

### Exact Test Flow

1. Developer creates the Google Cloud project and enables Drive API (requires separate approval).
2. Developer creates OAuth 2.0 credentials for a test web or desktop app (requires separate approval).
3. Developer adds Account A and Account B as test users on the OAuth consent screen.
4. Developer creates `poc1_test_file.txt` in Account A's Drive manually (no API call needed for creation).
5. Developer runs the OAuth flow for Account A, requesting only `drive.file` scope. Confirms the consent screen appears and access is granted.
6. **User action — Account A:** Using the Drive Picker widget, explicitly selects `poc1_test_file.txt`. The application receives the file ID.
7. Developer calls `permissions.create` via Drive API v3, authenticated as Account A (with `drive.file` token), to share `poc1_test_file.txt` with Account B's email address. Parameters: `role='reader'`, `type='user'`, `emailAddress=<Account B email>`.
8. Developer observes and records the exact API response (success or error code).
9. Developer runs the OAuth flow for Account B, requesting only `drive.file` scope.
10. Developer calls `files.copy` via Drive API v3, authenticated as Account B (with `drive.file` token), on the shared file's ID. No additional parameters beyond the file ID.
11. Developer observes and records the API response (new file ID, owner email, file name, size).
12. Developer opens Account B's Drive manually and confirms the new copy exists, is owned by Account B, and contains the expected content.
13. **Cleanup** (see Cleanup section).

### Explicit User Actions
- **Account A must explicitly select** `poc1_test_file.txt` via the Drive Picker UI in step 6. No automated bulk file listing or silent access.
- Both accounts must explicitly approve the OAuth consent screen when prompted.
- All cleanup actions (permission removal, file deletion) must be performed manually by the developer.

### Data Access Boundary

| Dimension | Boundary |
|---|---|
| Metadata accessed | File ID, file name, MIME type, owner, and size of the one selected test file only |
| Bytes accessed | File content bytes read during `files.copy` — Google executes server-side; no bytes transit through our code in this POC |
| Must never be accessed | Any other file in Account A's Drive; any other file in Account B's Drive; any Gmail, Calendar, Contacts, or Photos data |
| Byte persistence | No bytes are stored anywhere by our application in this POC — `files.copy` is a server-side Google operation |

### Success Criteria
1. `permissions.create` succeeds (HTTP 200) using `drive.file` token from Account A.
2. `files.copy` succeeds (HTTP 200) using `drive.file` token from Account B.
3. The copy in Account B's Drive is owned by Account B.
4. The copy content matches the original.
5. Account A's original file is unchanged and still present.
6. No scope error, 403, or 401 response at any step.

### Failure Criteria
1. `permissions.create` returns a `403` with a scope-related error while using `drive.file` — this means the share step requires a broader scope.
2. `files.copy` returns a `403` with a scope-related error while using `drive.file` — this means the copy step requires a broader scope.
3. Any unexpected data access occurs (e.g., a call succeeds but returns metadata for files other than the selected file).
4. The copy ends up owned by Account A rather than Account B.

### Expected Observations / Evidence
- HTTP response body for `permissions.create` call: full JSON logged, especially `id`, `role`, `type`.
- HTTP response body for `files.copy` call: full JSON logged, especially `id`, `owners[0].emailAddress`, `name`, `size`.
- Manual verification screenshot: Account B's Drive showing the copied file.
- Token scope confirmation: log the actual granted scopes from the OAuth token introspection or consent screen.

### Scope Escalation Rule
If `drive.file` is insufficient for step 7 or step 10:
- **Stop immediately**. Do not silently add a broader scope.
- Record the exact failing operation, error code, and message.
- Document that `drive.file` was insufficient for this exact operation under this POC setup.
- This becomes a separately reviewed decision; do not add any scope automatically.
- The finding must be documented in `docs/research_findings.md` and returned for architecture/scope review before any further POC execution or implementation.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account A: Remove Account B's permission from `poc1_test_file.txt` via Drive UI (Sharing → remove).
- Account B: Permanently delete the copied file from Drive (Trash → Empty Trash).
- Revoke OAuth application access from both accounts (Google Account Settings → Security → Third-party access).
- If OAuth credentials were created: document their client ID for the credential
  revocation step. Do not delete them yet — they will be reused for POC-2.
- Do not delete the test accounts until all POCs that use them are complete.

### Architecture Impact
- **Success:** Confirms the Non-sensitive `drive.file` architecture is viable for binary file copy. Removes the scope escalation risk for this path. POC-2 can proceed.
- **Failure (scope error at step 7 or step 10):** `drive.file` was insufficient for this exact operation under this POC setup. This does not automatically prove that a Restricted scope is necessary (another non-sensitive or differently designed flow could exist). Document the exact failing operation and error, and return for architecture/scope review before any further action. Do not add any scope automatically.
- **Failure (owner wrong):** `files.copy` ownership behavior is different from documented — investigate and re-assess.

---

## POC-2 — Drive Picker + Ownership Transfer Scope Test

### Priority
**P0 — Architecture blocker**

### Exact Question Being Tested
Does the complete Drive ownership transfer flow work using **only `drive.file` scope**
(Non-sensitive), when the source file was selected via the Google Drive Picker?

Specifically:
1. Can Account A call `permissions.create` with `pendingOwner: true` on a
   Picker-selected file using only `drive.file` scope?
2. Can Account B call `permissions.update` with `role: 'owner'` and
   `transferOwnership: true` on that file using only `drive.file` scope?
3. Does Account A's role downgrade to `writer` automatically?
4. What exact user interaction is required from Account B to accept?

### Why This POC Matters
Research confirmed that `permissions.create` and `permissions.update` documentation
lists both `drive` and `drive.file` as accepted scopes. If the full ownership transfer
flow works under `drive.file`, it provides an alternative migration path that preserves
the original file's identity (rather than creating a copy), and potentially avoids
Restricted scope requirements entirely. This is flagged as potentially better news than
the initial assessment. If it requires the Restricted `drive` scope, the path has
significant security assessment implications.

> [!NOTE]
> This POC should run **after POC-1**, because: (a) it reuses the same test accounts
> and infrastructure; (b) POC-1 validates the `permissions.create` mechanism first
> without the complexity of the ownership transfer handshake.

### Related Open Questions
- **OQ-D-OT-01** — Ownership transfer between personal @gmail.com accounts
- **OQ-D-OT-01-SCOPE** — Whether the full transfer flow works under `drive.file`
- **OQ-D-OT-02** — File types blocked from ownership transfer
- **OQ-D-OT-03** — Folder recursive transfer (partially confirmed: not recursive)
- **OQ-D-06** — OAuth verification tier implications

### Preconditions
- POC-1 has been executed (test accounts and OAuth credentials already exist).
- A new synthetic test file has been created in Account A's Drive for this POC.
  (Do not reuse POC-1 test file — ownership will change and the file will no
  longer belong to Account A after the test.)

### Test Accounts
Same disposable test accounts as POC-1.

### Test Data
- **File 2:** A plain text file (`poc2_ownership_test.txt`) containing
  `"POC-2 ownership transfer test. No personal data."` — created manually in
  Account A's Drive before the POC begins.
- No other files. No photos.

### Proposed Google APIs
- **Google Drive API v3** — NOT YET ENABLED (will be enabled for POC-1; reused here)
- **Google Drive Picker API** — NOT YET ENABLED (reused from POC-1)

### Proposed OAuth Scopes

**For Account A (source — initiating transfer):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | ⚠️ Candidate — this is the question | `permissions.create` with `pendingOwner: true` |

**For Account B (destination — accepting transfer):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | ⚠️ Candidate — this is the question | `permissions.update` with `transferOwnership: true` |

> [!IMPORTANT]
> Start with `drive.file` only. If the transfer handshake fails with a scope error
> at either step, apply the Scope Escalation Rule. Do not assume `drive` is required.

### Exact Test Flow

1. Developer creates `poc2_ownership_test.txt` manually in Account A's Drive.
2. **User action — Account A:** Using the Drive Picker, explicitly selects `poc2_ownership_test.txt`. Application receives the file ID.
3. Developer calls `permissions.create` authenticated as Account A (`drive.file` token), with: `role='writer'`, `type='user'`, `emailAddress=<Account B email>`, `pendingOwner=true`.
4. Developer observes and records API response (success or error).
5. Developer checks whether Account B receives an email notification about the ownership transfer request.
6. Developer calls `permissions.update` (or `permissions.create`) authenticated as Account B (`drive.file` token), with: `role='owner'`, `transferOwnership=true`, for the same file ID and permission ID.
7. Developer observes and records API response.
8. Developer checks Account A's Drive: confirms Account A's role is now `writer` (not `owner`).
9. Developer checks Account B's Drive: confirms Account B is now the `owner`.
10. Developer records the exact user-facing steps required from Account B to accept (email link, Drive UI, or API-only).
11. **Cleanup** (see Cleanup section).

### Explicit User Actions
- **Account A** must explicitly select the file via Drive Picker (step 2).
- **Account B** must explicitly accept the ownership transfer — the exact mechanism
  (email notification link, Drive UI `Accept` button, or API call) must be documented
  as part of this POC's evidence.
- Both accounts must explicitly approve the OAuth consent screen.

### Data Access Boundary

| Dimension | Boundary |
|---|---|
| Metadata accessed | File ID, name, owners, permissions for the one selected test file only |
| Bytes accessed | None — no byte download or upload in this POC |
| Must never be accessed | Any other file in either account; Gmail messages; Photos |
| Byte persistence | No bytes are accessed or stored |

### Success Criteria
1. `permissions.create` with `pendingOwner: true` succeeds using `drive.file` token.
2. Account B successfully becomes owner using `drive.file` token.
3. Account A's role automatically downgrades to `writer`.
4. The file content is unchanged.
5. No scope error at any step.

### Failure Criteria
1. Either permission call returns a scope-related `403` error under `drive.file`.
2. The `pendingOwner` flag is not accepted (parameter not recognized).
3. Account B cannot complete the acceptance step using `drive.file` scope.
4. The `consentRequiredForOwnershipTransfer` error is returned (meaning the two-step
   process is enforced but our flow is not triggering it correctly).

### Expected Observations / Evidence
- Full JSON API responses for both permission calls, logged.
- Screenshot of Account B's Drive showing it as the new owner.
- Screenshot of Account A's Drive showing `writer` role (not owner).
- Record of whether Account B needed to take a UI action or whether the API call alone completed the transfer.
- Record of the exact scopes granted in both tokens (from consent screen or token inspection).

### Scope Escalation Rule
If `drive.file` is insufficient at either step:
- **Stop immediately**. Record the exact failing operation, error code, and message.
- Document that `drive.file` was insufficient for this exact operation under this POC setup.
- This becomes a separately reviewed decision; do not add any scope automatically.
- Return for architecture/scope review before any further action.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account A: Manually verify Account A's role on `poc2_ownership_test.txt` (now owner is Account B — Account A should have writer access). If desired, Account A can request Account B to return ownership or simply revoke sharing.
- Account B: Permanently delete `poc2_ownership_test.txt` from Drive (it is now Account B's file).
- Revoke application access from both accounts.

### Architecture Impact
- **Success:** Ownership transfer is viable under Non-sensitive scope. This opens a second migration path for Drive: instead of copying, ownership can be transferred, which means Account B gets the exact file with the same history (minus the pre-transfer history caveat). The UI flow requires explicit user confirmation from Account B.
- **Failure:** `drive.file` was insufficient for the ownership transfer flow under this POC setup. This only proves that the tested configuration failed; next scope or architecture decisions require separate review. If the share-then-copy path (POC-1) succeeded, it remains the primary candidate.

---

## POC-3 — Photos Picker API Scope Classification and Basic Upload

### Priority
**P0 — Architecture blocker**

### Exact Question Being Tested
1. What is the OAuth verification tier of `photospicker.mediaitems.readonly`?
   (Non-sensitive, Sensitive, or Restricted?)
2. What is the OAuth verification tier of `photoslibrary.appendonly`?
3. Does the complete Photos Picker → bytes → Library upload flow work in practice?

Specifically:
- Can Account A authenticate with `photospicker.mediaitems.readonly` and create
  a Picker session?
- Does the `pickerUri` direct Account A to Google's own photo selection UI?
- After Account A selects one photo, does `mediaItems.list` return a `baseUrl`?
- Can the application download the photo bytes from `baseUrl`?
- Can Account B authenticate with `photoslibrary.appendonly` and upload those bytes?
- Does `mediaItems:batchCreate` create the photo in Account B's library?

### Why This POC Matters
The Photos architecture is predicated on two unverified scope classifications. If either
`photospicker.mediaitems.readonly` or `photoslibrary.appendonly` is Restricted, the
Photos architecture has the same security assessment implications as using Restricted
Drive scopes. This POC resolves that uncertainty and validates the fundamental Photos
transfer flow — without it, no Photos implementation should begin.

Unlike Drive (where `files.copy` is a server-side operation and no bytes transit
through our server), Photos **requires bytes to flow through our server**. This POC
also validates that the byte flow is technically feasible at a basic level.

### Related Open Questions
- **OQ-P-01** — Google Photos Picker API existence (confirmed in research; flow details unverified)
- **OQ-P-02** — Minimum Photos scopes and their tier classifications
- **OQ-P-03** — Media download and upload feasibility
- **OQ-P-07** — Photos ToS compliance

### Preconditions
- POC approval gate passed.
- Google Cloud project exists (may reuse POC-1 project or create new — separate decision).
- Photos Library API enabled in the project.
- Photos Picker API enabled in the project.
- OAuth credentials created (separate approval step).
- Two disposable test accounts exist.
- One synthetic test image created (see Test Data).

### Test Accounts
- **Account A (source):** Same disposable test account used in POC-1/POC-2, or a new
  one if preferred. Must have exactly one synthetic test image in its Photos library.
- **Account B (destination):** Same or new disposable account. Its Photos library must
  be empty before the test.

### Test Data
- **Image 1:** A 10 KB or smaller JPEG file (`poc3_test_photo.jpg`), synthetic.
  Content: a solid color rectangle generated programmatically. No EXIF beyond
  minimal structural headers. No GPS data. No personal imagery.
  This image must be manually uploaded to Account A's Google Photos before the POC
  begins (via the Google Photos web UI — no API used for initial setup).

### Proposed Google APIs
- **Google Photos Picker API** (`photospicker.googleapis.com/v1/`) — NOT YET ENABLED
- **Google Photos Library API** (`photoslibrary.googleapis.com/v1/`) — NOT YET ENABLED

### Proposed OAuth Scopes

**For Account A (source — Picker):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` | ⚠️ Classification unverified — **this is what the POC resolves** | Picker session creation and media item listing |

**For Account B (destination — upload):**

| Scope | Status | Role |
|---|---|---|
| `https://www.googleapis.com/auth/photoslibrary.appendonly` | ⚠️ Classification unverified — **this is what the POC resolves** | Upload bytes and create media item |

> [!IMPORTANT]
> Observe the OAuth consent screen carefully during the flow. The tier of each scope
> is visible: the consent screen distinguishes Non-sensitive, Sensitive (shows a
> warning), and Restricted (shows a strong warning and may block unverified apps).
> Record exactly what the consent screen shows for each scope. This is primary evidence
> for the scope classification question.

### Exact Test Flow

**Phase A — Source (Account A):**
1. Developer runs OAuth flow for Account A with `photospicker.mediaitems.readonly` scope.
2. Developer records the exact consent screen text and warning level shown.
3. Developer calls `sessions.create` (POST to `https://photospicker.googleapis.com/v1/sessions`).
4. Developer records the `sessionId` and `pickerUri` from the response.
5. **User action — Account A:** Developer navigates to the `pickerUri` in a browser.
   Account A sees Google's own photo picker UI. Account A explicitly selects `poc3_test_photo.jpg`.
6. Developer polls `sessions.get` until `mediaItemsSet` is `true`.
7. Developer calls `mediaItems.list` with the `sessionId`.
8. Developer records the response: `id`, `baseUrl`, `mimeType` for the selected item.
9. Developer makes a GET request to `<baseUrl>=d` (full download parameter) to retrieve
   the image bytes. Records: HTTP status, Content-Type header, byte count received.
10. Developer stores bytes in a temporary local variable only — **no file system
    persistence, no database write, no logging of byte content**.

**Phase B — Destination (Account B):**
11. Developer runs OAuth flow for Account B with `photoslibrary.appendonly` scope.
12. Developer records the exact consent screen text and warning level shown.
13. Developer uploads image bytes to `https://photoslibrary.googleapis.com/v1/uploads`
    with required headers (`Content-type: application/octet-stream`,
    `X-Goog-Upload-Protocol: raw`, `X-Goog-Upload-File-Name: poc3_test_photo.jpg`).
14. Developer records the upload token returned.
15. Developer calls `mediaItems:batchCreate` with the upload token and a simple description.
16. Developer records the API response (new media item ID, creation status).
17. Developer manually opens Account B's Google Photos library in a browser and confirms
    the photo appears.
18. Developer records: whether the photo appears, what date is shown, any metadata visible.

**Phase C — Cleanup** (see Cleanup section).

### Explicit User Actions
- **Account A** must explicitly select `poc3_test_photo.jpg` in the Google Photos picker UI (step 5). Account A does not see any other photo in the picker and does not need to interact with anything else.
- Both accounts must explicitly approve the OAuth consent screen when prompted.

### Data Access Boundary

| Dimension | Boundary |
|---|---|
| Metadata accessed | `id`, `baseUrl`, `mimeType` for the one selected photo only |
| Bytes accessed | Bytes of `poc3_test_photo.jpg` — downloaded from `baseUrl` during test execution |
| Must never be accessed | Any other photo or video in Account A's library; any Gmail, Drive, Contacts, or Calendar data |
| Byte persistence | **Bytes must NOT be written to disk, logged, or persisted in any form.** In-memory transfer only during the POC. |

### Success Criteria
1. `sessions.create` returns a valid `sessionId` and `pickerUri`.
2. `mediaItems.list` returns exactly one item (the selected photo) with a valid `baseUrl`.
3. `baseUrl` GET request returns the image bytes (HTTP 200, correct Content-Type, correct byte count).
4. Upload to Library API returns a valid upload token.
5. `mediaItems:batchCreate` succeeds and returns a new media item ID.
6. Photo appears in Account B's Google Photos library.
7. No `RESTRICTED` or `SENSITIVE` warning seen that would prevent unverified app use beyond 100 test users (document what is observed regardless).
8. No scope-related error at any step.

### Failure Criteria
1. Any scope-related `403` error at any step.
2. `baseUrl` returns `403 Forbidden` or `401 Unauthorized` (baseUrl may have time limits or token binding — document observed behavior).
3. `photoslibrary.appendonly` is blocked by an "unverified app" screen that prevents authentication beyond 100 users (record and document — this is still valid information, but means the path requires formal verification).
4. Upload fails or `batchCreate` returns an error status.

### Expected Observations / Evidence
- Screenshot of the OAuth consent screen for `photospicker.mediaitems.readonly` (classify as Non-sensitive / Sensitive / Restricted from the UI).
- Screenshot of the OAuth consent screen for `photoslibrary.appendonly` (same classification).
- JSON response from `sessions.create` (sessionId and pickerUri).
- JSON response from `mediaItems.list` (item ID, baseUrl, mimeType).
- HTTP headers from `baseUrl` GET request (Content-Type, Content-Length).
- HTTP response from upload endpoint (upload token string).
- JSON response from `batchCreate` (new item ID, creation status).
- Screenshot of Account B's Photos library showing the uploaded photo.

### Scope Escalation Rule
If either scope produces an "unverified app" block that prevents use with even test accounts:
- **Stop immediately**. Document the exact screen seen.
- Adding test users to the OAuth consent screen in the Google Cloud project may
  resolve this for testing only. Record whether this is required.
- If a scope is found to be Restricted (not merely Sensitive), this must be a
  separately reviewed decision before Photos implementation proceeds.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account A: Revoke application access (Google Account Settings → Security → Third-party access).
- Account B: Delete `poc3_test_photo.jpg` from Photos library (Google Photos UI → Delete → Empty Trash).
- Account B: Revoke application access.
- Delete the temporary test image from local storage (the in-memory bytes from step 9).
- Delete Account A's original `poc3_test_photo.jpg` from Account A's Photos library (it was manually uploaded for setup; remove it now).

### Architecture Impact
- **Success (both scopes are Non-sensitive or Sensitive):** The Photos architecture is viable. Proceed to POC-5 (EXIF) and POC-6 (video).
- **Success (one or both scopes are Sensitive):** Architecture is still viable but OAuth app verification is required before public release. Scopes must be declared in the privacy policy and go through Google review. Document the expected verification timeline.
- **Failure (either scope is Restricted):** Photos migration has the same security assessment implications as using Restricted Drive scopes. The architecture must be reassessed before Photos implementation begins.

---

## POC-4 — Google-Native File Fidelity via `files.copy`

### Priority
**P1 — Important before MVP implementation**

> [!NOTE]
> This POC should only be executed after POC-1 succeeds, because it depends on
> the `files.copy` mechanism being confirmed viable under `drive.file` scope.

### Exact Question Being Tested
When Account A shares a Google-native file (Docs, Sheets, Slides) with Account B,
and Account B calls `files.copy` on it:
1. Does the resulting copy open correctly as a Google-native file in Account B's Drive?
2. What formatting, content, named ranges, or features are preserved or lost?
3. Is the copy fidelity acceptable for the MVP's stated user experience?

### Why This POC Matters
The product requirements treat Google-native files differently from binary files.
`files.copy` is the preferred mechanism (no byte streaming, server-side operation,
no export/import MIME type round-trip). However, the copy loses revision history
and comments. This POC validates whether the fidelity of `files.copy` for native
files is acceptable to users or whether additional warnings need to be surfaced in the UI.

### Related Open Questions
- **OQ-D-04** — Native file export/import metadata loss extent
- **OQ-D-01** — `files.copy` cross-account behavior for native files

### Preconditions
- POC-1 has been executed and succeeded (confirms `files.copy` and `drive.file` scope work).

### Test Accounts
Same disposable test accounts as POC-1/POC-2.

### Test Data
Three synthetic test files, created manually in Account A's Google Drive:

- **Doc 1:** `poc4_test_doc.gdoc` — A Google Doc with: a heading, a paragraph, a table,
  a bulleted list, one comment, and bold/italic formatting. No personal content.
- **Sheet 1:** `poc4_test_sheet.gsheet` — A Google Sheet with: two tabs, one named range,
  a SUM formula, and a chart. No personal content.
- **Slide 1:** `poc4_test_slides.gslide` — A Google Slides file with: two slides,
  a text box, and an inserted shape. No personal content.

### Proposed Google APIs
- **Google Drive API v3** — NOT YET ENABLED (reused from POC-1)

### Proposed OAuth Scopes

| Scope | Account | Status |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | Account A | ✅ Confirmed Non-sensitive (from POC-1) |
| `https://www.googleapis.com/auth/drive.file` | Account B | ✅ Confirmed Non-sensitive (from POC-1) |

### Exact Test Flow

For each of the three test files (Doc, Sheet, Slides):
1. **User action — Account A:** Select the file via the Drive Picker.
2. Call `permissions.create` (Account A, `drive.file`) to share with Account B as reader.
3. Call `files.copy` (Account B, `drive.file`) on the shared file ID.
4. Manually open the copy in Account B's Google Drive.
5. Record: Does it open? Are all formatting elements present? Is the comment present?
   Are named ranges preserved (Sheets)? Are formulas preserved?

### Explicit User Actions
- Account A must select each file explicitly via Drive Picker before sharing.

### Data Access Boundary

| Dimension | Boundary |
|---|---|
| Metadata accessed | File ID, name, MIME type for each selected test file |
| Bytes accessed | None — `files.copy` is server-side; no bytes transit our application |
| Must never be accessed | Any other Drive content in either account |
| Byte persistence | Not applicable |

### Success Criteria
1. All three native file types copy successfully.
2. Formatting (bold, italic, tables, formulas) is preserved in the copy.
3. Named ranges (Sheets) are preserved.
4. The copy opens correctly in the destination account as a Google-native file.

### Failure Criteria
1. Any file type fails to copy.
2. Significant formatting degradation is observed (e.g., formula breakage, chart loss).
3. Named ranges are destroyed (Sheets).

### Expected Observations / Evidence
- For each file type: side-by-side screenshot of original vs. copy (opened in Account B's Drive).
- Record of what was and was not preserved (formatted as a table in the POC results document).
- Note whether comments appear in the copy.

### Scope Escalation Rule
Not applicable — scope is confirmed from POC-1.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account A: Remove Account B's permissions from all three test files.
- Account B: Delete all three copied files.
- Revoke application access from both accounts if re-granted.

### Architecture Impact
- **Success:** `files.copy` is confirmed suitable for Google-native file migration. The UI must warn users that comments and revision history are not transferred.
- **Failure (specific file type):** That file type requires a different mechanism (export/import or warning to user). Document which types and what the alternative is.
- **Failure (all types):** Native file migration is not viable via `files.copy` — must reconsider architecture for this file category.

---

## POC-5 — Photos EXIF and Metadata Preservation

### Priority
**P1 — Important before MVP implementation**

> [!NOTE]
> This POC should only be executed after POC-3 succeeds.

### Exact Question Being Tested
When a JPEG photo is downloaded via the Photos Picker `baseUrl` and re-uploaded to
a destination Google Photos library via the Library API:
1. Does Google Photos read the `DateTimeOriginal` EXIF tag and use it as the photo's
   date in the destination library?
2. Does GPS EXIF data survive the transfer?
3. What date does Google Photos assign when EXIF is absent?

### Why This POC Matters
EXIF preservation affects whether photos appear on the correct date in the destination
account's Google Photos timeline. This is a primary user expectation and a stated
product requirement. The research phase confirmed that `batchCreate` has no `creationTime`
API parameter — EXIF is the only mechanism. Whether Google Photos actually reads it
during the Library API upload path (as opposed to the web UI upload path) must be
verified with a controlled experiment.

### Related Open Questions
- **OQ-P-04** — EXIF/timestamp/GPS preservation after upload

### Preconditions
- POC-3 has been executed and succeeded.

### Test Accounts
Same disposable test accounts as POC-3.

### Test Data
Three synthetic JPEG files, generated programmatically (solid colors, no real photography):

- **Image A:** `poc5_with_exif_date.jpg` — JPEG with `DateTimeOriginal` EXIF tag set to
  a date in the past (e.g., 2020-01-15 12:00:00). No GPS data.
- **Image B:** `poc5_with_exif_gps.jpg` — JPEG with `DateTimeOriginal` AND GPS coordinates
  embedded (use a fictional location, e.g., 0°N 0°E). Coordinates must not correspond
  to any real address or identifiable location.
- **Image C:** `poc5_no_exif.jpg` — JPEG with no EXIF data of any kind (or only minimal
  structural EXIF). Used to observe Google's fallback behavior.

All three must be manually uploaded to Account A's Google Photos before the POC.

### Proposed Google APIs
- **Google Photos Picker API** — NOT YET ENABLED (reused from POC-3)
- **Google Photos Library API** — NOT YET ENABLED (reused from POC-3)

### Proposed OAuth Scopes
Same as POC-3 (confirmed from POC-3 execution).

### Exact Test Flow

For each of the three test images:
1. **User action — Account A:** Select the image via the Photos Picker.
2. Call `mediaItems.list` to get `baseUrl`.
3. GET `<baseUrl>=d` to download bytes (in-memory only, no persistence).
4. Upload bytes to `https://photoslibrary.googleapis.com/v1/uploads` as Account B.
5. Call `mediaItems:batchCreate` with upload token.
6. Wait 60 seconds for processing.
7. Manually open Account B's Google Photos library and navigate to the uploaded photo.
8. Record: what date is displayed? Is a location shown (for Image B)?

### Explicit User Actions
- Account A must explicitly select each image via the Photos Picker.

### Data Access Boundary
Same as POC-3. Bytes are in-memory only. No persistence.

### Success Criteria
- Image A appears in Account B's Photos timeline under the 2020-01-15 date.
- Image B appears with the correct date AND shows a map location.
- Image C appears with a date (document what date — upload time or something else).

### Failure Criteria
- Image A appears with the upload date instead of the EXIF date. This means EXIF
  is not reliably preserved via the Library API upload path — the product must warn users.
- Image B shows no location data.

### Expected Observations / Evidence
- Screenshot of each photo's detail view in Account B's Photos library, showing the date displayed.
- For Image B: screenshot showing whether a location is shown.
- Document the exact date assigned to Image C.

### Scope Escalation Rule
Not applicable — scope is confirmed from POC-3.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account B: Delete all three test photos.
- Account A: Delete all three original test photos from Account A's library.
- Revoke application access from both accounts if re-granted.

### Architecture Impact
- **Success (EXIF preserved):** No special handling needed. Server-side pass-through preserves dates and GPS. Standard EXIF handling note added to documentation.
- **Failure (EXIF not preserved):** Product must warn users that photos may appear with wrong dates. Consider whether to embed EXIF server-side before upload (would require EXIF processing — additional complexity). This becomes a product decision.
- **Failure (GPS not preserved):** Document. Warn users. GPS is a secondary concern compared to dates.

---

## POC-6 — Photos Video Transfer and Processing Status

### Priority
**P1 — Important before MVP implementation**

> [!NOTE]
> Execute after POC-3 succeeds. Can be executed in parallel with POC-5.

### Exact Question Being Tested
1. Does the Photos Picker return video files in `mediaItems.list` alongside photos?
2. Can video bytes be downloaded from `baseUrl`?
3. Does the Library API accept video upload via the same `v1/uploads` endpoint?
4. What is the `videoProcessingStatus` lifecycle? How long until the video is available?

### Why This POC Matters
Video handling is a distinct concern from photo handling: videos are much larger (up
to 20 GB), take time to process after upload, and may require different streaming
behavior. Separating this from POC-3 (photos) allows us to isolate video-specific
issues without clouding the basic photo flow result.

### Related Open Questions
- **OQ-P-05** — Video transfer handling and processing delay

### Preconditions
- POC-3 has been executed and succeeded.

### Test Accounts
Same disposable test accounts.

### Test Data
- **Video 1:** `poc6_test_video.mp4` — A 5-second synthetic video, under 10 MB.
  Content: a solid color screen. Generated programmatically (e.g., via `ffmpeg`).
  No audio. No personal content.
  Manually uploaded to Account A's Photos before the POC.

### Proposed Google APIs
- **Google Photos Picker API** — NOT YET ENABLED (reused from POC-3)
- **Google Photos Library API** — NOT YET ENABLED (reused from POC-3)

### Proposed OAuth Scopes
Same as POC-3.

### Exact Test Flow

1. **User action — Account A:** Select `poc6_test_video.mp4` via the Photos Picker.
2. Call `mediaItems.list` — record: does the response include the video? Does it return a `baseUrl`?
3. GET `<baseUrl>=dv` (video download parameter) — record HTTP status, Content-Type, byte count.
4. Upload bytes to Library API `v1/uploads` as Account B (in-memory only).
5. Call `batchCreate` with upload token.
6. Record the initial `videoProcessingStatus` from the response.
7. Poll `mediaItems.get` at 30-second intervals. Record how long until status becomes `READY`.
8. Manually open Account B's Photos library and confirm the video plays.

### Explicit User Actions
- Account A must explicitly select the video via the Photos Picker.

### Data Access Boundary
Same as POC-3. Bytes are in-memory only.

### Success Criteria
1. Video appears in `mediaItems.list` response.
2. Video bytes are downloadable from `baseUrl`.
3. Upload succeeds and `batchCreate` accepts the video.
4. `videoProcessingStatus` eventually reaches `READY`.
5. Video plays correctly in Account B's library.

### Failure Criteria
1. Video does not appear in Picker results.
2. `baseUrl` for video is not downloadable.
3. `batchCreate` rejects the video (format, size, or scope issue).
4. `videoProcessingStatus` stays in `PROCESSING` indefinitely.

### Expected Observations / Evidence
- JSON from `mediaItems.list` including video item details.
- HTTP response headers from video byte download.
- `videoProcessingStatus` polling log with timestamps.
- Screenshot of playing video in Account B's library.

### Scope Escalation Rule
Not applicable — scope is confirmed from POC-3.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account B: Delete test video.
- Account A: Delete original test video from Photos library.
- Revoke application access if re-granted.

### Architecture Impact
- **Success:** Confirms video transfer is viable. Documents the processing delay (needed for UX — the application must show a "processing" state to users).
- **Failure (video not in Picker):** Videos may need to be selected differently, or a separate mechanism is needed.
- **Failure (processing never completes):** Video transfer may require a different approach or a significant UX change (async notification to user).

---

## POC-7 — Large File Streaming: Memory, Timeout, and Resumability

### Priority
**P2 — Can be tested later**

> [!NOTE]
> Do not execute until POC-1 (Drive) and POC-3 (Photos) both succeed, confirming
> the basic flows are viable. Large file streaming is a performance and infrastructure
> concern — it is not an architecture blocker if basic flows work.

### Exact Question Being Tested
For Photos migration (which requires server-side byte streaming):
1. Can the server stream bytes from the Photos Picker `baseUrl` to the Library API
   upload endpoint without buffering the entire file in memory?
2. What is the memory footprint of the streaming operation for files at 50 MB, 100 MB?
3. How does the system behave if the connection is interrupted mid-transfer?
4. Does the Library API support resumable uploads for large files?

For Drive migration (where `files.copy` is server-side and does not stream through us):
- This POC applies **only to Photos**. Drive binary files use `files.copy` (no streaming).
  If an alternative Drive mechanism is needed for specific file types, that is a
  separate decision after POC-1/POC-2 results.

### Why This POC Matters
Memory and timeout constraints are infrastructure-level questions that cannot be
answered from documentation alone. A server that streams 5 GB video files from
Photos must be able to do so without running out of memory or hitting platform
timeouts. This POC establishes the practical limits before any infrastructure
decisions are made.

### Related Open Questions
- **OQ-I-03** — Large file streaming and timeouts
- **OQ-I-04** — Practical rate limits for bulk migration
- **OQ-I-05** — Infrastructure cost of byte streaming
- **OQ-P-06** — Resumability and duplicate prevention

### Preconditions
- POC-3 and POC-6 have been executed and succeeded.
- A decision on server language and framework has been made (OQ-I-01, OQ-I-02).

### Test Accounts
Same disposable test accounts.

### Test Data
- **Large Photo:** `poc7_large_photo.jpg` — A JPEG at approximately 50 MB (synthetically
  generated, solid gradients, no personal content).
- **Large Video:** `poc7_large_video.mp4` — An MP4 at approximately 200 MB (synthetic,
  solid color, no personal content, no audio).
  Both uploaded to Account A's Photos before the POC.

### Proposed Google APIs
- **Google Photos Picker API** — NOT YET ENABLED (reused)
- **Google Photos Library API** — NOT YET ENABLED (reused)

### Proposed OAuth Scopes
Same as POC-3 (confirmed from POC-3 execution).

### Exact Test Flow

**Streaming test:**
1. Download bytes from Picker `baseUrl` in chunks (e.g., 1 MB chunks using HTTP `Range` headers if supported, or streaming response body).
2. Forward each chunk immediately to the Library API upload endpoint without accumulating the full file in memory.
3. Record: peak memory usage during the operation; time to complete; whether the upload token must be obtained before streaming begins (pre-flight requirement).

**Interruption test:**
4. Begin a large file streaming transfer.
5. Simulate an interruption at the 50% mark (disconnect or kill the streaming process).
6. Attempt to resume using the Library API resumable upload session.
7. Record: does the Library API accept a resume? From what byte offset?

**Timeout test:**
8. Determine the maximum time before the Picker `baseUrl` expires (attempt an access 1 hour, 6 hours after session creation).
9. Record when `baseUrl` access begins returning 403.

### Explicit User Actions
Account A must explicitly select each file via the Photos Picker before the streaming test begins.

### Data Access Boundary
Same as POC-3. Bytes in-memory / in-transit only. No persistence.

### Success Criteria
1. 50 MB photo streams without the server process exceeding a defined memory threshold (to be set by the developer based on chosen infrastructure).
2. The transfer completes without timeout.
3. The Library API resumable upload allows restart from an offset after interruption.

### Failure Criteria
1. Peak memory usage exceeds available server memory during streaming.
2. The `baseUrl` expires before the upload completes for large files.
3. The Library API does not support true resumable uploads — the full file must be re-uploaded on failure.

### Expected Observations / Evidence
- Memory usage profile during streaming (from server process monitoring).
- Total transfer time for each file size.
- `baseUrl` expiry behavior (HTTP status at each test interval).
- Library API resumable upload session behavior (success or error with offset).

### Scope Escalation Rule
Not applicable — scope is confirmed from POC-3.

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
- Account B: Delete all large test files from Photos library.
- Account A: Delete original large test files from Photos library.

### Architecture Impact
- **Success:** Confirms streaming architecture is viable on the chosen infrastructure. Sets constraints for the server (memory limit, timeout limit) that must be respected in production.
- **Failure (memory):** Chunked streaming must be implemented differently, or infrastructure must be upgraded.
- **Failure (baseUrl expiry):** The entire transfer must complete within the `baseUrl` validity window. Large files may need chunked resumable sessions opened before the window expires.
- **Failure (no resumable upload):** Duplicate prevention becomes critical — a failed upload must be detectable and the re-upload must be safe.

---

## POC-8 — Duplicate Prevention Mechanism

### Priority
**P2 — Can be tested later**

### Exact Question Being Tested
If a Photos migration operation partially fails and is retried:
1. Does Google Photos deduplicate identical uploads automatically?
2. If not, what metadata can we use to detect a duplicate before re-uploading?
3. Can we implement a safe idempotency check?

### Why This POC Matters
Without duplicate prevention, a failed migration attempt followed by a retry would
create duplicate photos in Account B's library. This is a fundamental reliability
requirement. Understanding Google's deduplication behavior (or lack thereof) determines
what application-level deduplication logic is needed.

### Related Open Questions
- **OQ-P-06** — Resumability and duplicate prevention

### Preconditions
- POC-3 has been executed and succeeded.

### Test Data
A single synthetic JPEG already used in POC-3 or POC-5 (same file, not re-creating).

### Proposed APIs
- **Google Photos Library API** — NOT YET ENABLED (reused)

### Exact Test Flow
1. Upload `poc3_test_photo.jpg` to Account B's library (using POC-3 flow).
2. Upload the **same bytes** again immediately.
3. Call `mediaItems.list` and count how many copies appear in Account B's library.
4. Record: Google Photos deduplication result.

### Success Criteria
Google Photos either: (a) deduplicates and returns a reference to the existing item, OR (b) the API returns a clear error indicating a duplicate. Either outcome allows us to build reliable idempotency.

### Failure Criteria
Google Photos silently creates a duplicate without any indication. Application-level deduplication must be implemented (e.g., by tracking uploaded item IDs in a local migration state file).

### Cleanup
> **Note:** Any deletion in POC cleanup is performed manually by the developer/test-account owner through Google's UI (or separately approved test cleanup steps). It is not evidence that the future application will have deletion capability.
Delete all duplicate copies from Account B's library.

### Architecture Impact
- **Success (dedup exists):** Migration retries are safe by default. Minimal application-level dedup logic needed.
- **Failure (no dedup):** Application must maintain a persistent migration state file tracking which items have been successfully uploaded. This adds implementation complexity and is a new open question.

---

# Recommended Execution Order

| Rank | POC | Priority | Rationale |
|---|---|---|---|
| **1st** | **POC-1** | P0 | Answers the single most important architecture question: does `drive.file` work end-to-end for the share-then-copy flow? All other Drive work depends on this. |
| **2nd** | **POC-2** | P0 | Reuses POC-1 infrastructure. Answers whether ownership transfer stays Non-sensitive. High value of information at near-zero additional setup cost. |
| **3rd** | **POC-3** | P0 | Resolves both unverified Photos scope classifications and validates the basic Photos flow. The Photos architecture cannot be confirmed until this runs. |
| **4th** | **POC-4** | P1 | Depends on POC-1. Validates native file fidelity — needed before implementing the Docs/Sheets/Slides migration UI path. |
| **5th** | **POC-5** | P1 | Depends on POC-3. Validates EXIF preservation — needed before finalizing the Photos transfer implementation. |
| **6th** | **POC-6** | P1 | Depends on POC-3. Can run in parallel with POC-5. Validates video transfer — needed before implementing video support. |
| **7th** | **POC-7** | P2 | Depends on POC-3 + POC-6 + infrastructure decision. Performance/infrastructure concern — not an architecture blocker. |
| **8th** | **POC-8** | P2 | Depends on POC-3. Reliability concern — important before production but not a feasibility blocker. |

**Branching rule:** If POC-1 fails (scope escalation required):
- Pause all Drive POCs.
- Document the scope required.
- Review architecture implications before proceeding.
- POC-3 (Photos) can still proceed independently.

**Branching rule:** If POC-3 fails (scope is Restricted):
- Pause all Photos POCs.
- Document the scope classification found.
- Review architecture implications before proceeding.
- Drive POCs (POC-2, POC-4) can still proceed independently.

---

# Fastest Safe Path to First Execution

## The Single Best First POC: **POC-1**

**Why POC-1 first:**

POC-1 tests the most consequential assumption in the entire Drive architecture: that
`drive.file` scope — a Non-sensitive scope requiring no formal Google security
assessment — is sufficient for both sharing a Picker-selected file and copying it
to a destination account. Every other Drive POC, and the MVP Drive implementation
itself, depends on this answer.

**The smallest possible experiment:**
- Two disposable Gmail accounts
- One plain text file (< 1 KB)
- One Google Cloud project
- Two OAuth 2.0 flows (one per account)
- Two API calls: `permissions.create` and `files.copy`
- No bytes transit our application (server-side copy)
- Entire test can be conducted in under 30 minutes once setup is complete

**The one result that will be learned:**

*Either* `drive.file` is sufficient for the full share-and-copy flow — confirming
the Non-sensitive architecture — *or* a specific step fails with a scope error,
precisely identifying what scope escalation is required.

There is no ambiguous middle outcome. The test is binary.

**Decisions that depend on POC-1:**
1. Whether the Drive MVP architecture is confirmed as Non-sensitive (no security assessment).
2. Whether POC-2 (ownership transfer) is worth pursuing as an alternative path.
3. Whether POC-4 (native file fidelity) can proceed.
4. Whether Drive implementation can begin.

**If POC-1 succeeds and takes 30 minutes:** POC-2 can follow immediately using the
same accounts and credentials, answering the ownership-transfer scope question at
almost no additional cost.

---

# POC Approval Gates

These gates must be passed **in order**. No gate may be bypassed silently.

---

## Gate 0 — Before Anything Else (This Document)

**Required before any other action:**

- [ ] This `docs/poc_plan.md` is reviewed and approved by the user.
- [ ] User confirms: "Proceed to Gate 1."

**What this gate protects:** Ensures the POC scope, test data, and approach are
agreed before any infrastructure is created.

---

## Gate 1 — Before Creating a Google Cloud Project

**Required before creating any Google Cloud project:**

- [ ] Gate 0 is passed.
- [ ] User confirms which test Google account will own the Google Cloud project
      (this must be a disposable test account, not a real personal account).
- [ ] User confirms that disposable test accounts (Account A and Account B) have
      been created with no personal data.
- [ ] User confirms the first POC to be executed (recommended: POC-1).

**What this gate protects:** Ensures the Cloud project is created under a test identity
and only for an approved POC scope.

---

## Gate 2 — Before Enabling APIs

**Required before enabling any Google API in the Cloud project:**

- [ ] Gate 1 is passed.
- [ ] The Google Cloud project exists and the developer has confirmed its project ID.
- [ ] The specific APIs to enable for the approved POC are listed (e.g., for POC-1:
      Drive API v3 and Drive Picker API only).
- [ ] No other APIs are enabled that are not required for the approved POC.

**What this gate protects:** Prevents unnecessary API enablement from expanding the
project's permission surface.

---

## Gate 3 — Before Creating OAuth Credentials

**Required before creating any OAuth 2.0 client ID:**

- [ ] Gate 2 is passed.
- [ ] OAuth consent screen configuration has been reviewed: application name, scopes
      requested, and test user list are confirmed as correct and minimal.
- [ ] The scopes declared in the consent screen match exactly those proposed in the
      approved POC (no additional scopes).
- [ ] Application type (desktop or web) has been decided.
- [ ] Client ID and secret will be stored securely and never committed to any source
      control repository.

**What this gate protects:** Ensures credentials are created with the minimum scope
and stored safely. Scope creep on the consent screen is caught before credentials exist.

---

## Gate 4 — Before Authenticating Test Accounts

**Required before running the OAuth flow with any test account:**

- [ ] Gate 3 is passed.
- [ ] The developer has confirmed both test accounts contain only the synthetic test
      data defined in the POC.
- [ ] The developer has confirmed both test accounts are listed as test users in the
      OAuth consent screen.
- [ ] The developer understands: if either test account is blocked by an "unverified app"
      screen, the Scope Escalation Rule applies — no scope must be added without review.

**What this gate protects:** Prevents accidental OAuth with real accounts or unexpected scope expansion.

---

## Gate 5 — Before Executing POC-1

**Required before calling any API:**

- [ ] Gates 1–4 are passed.
- [ ] Synthetic test data is confirmed present in Account A's Drive (manually verified,
      not via API).
- [ ] Account B's Drive is confirmed empty.
- [ ] The developer has read and understood the POC-1 `Cleanup` section and commits
      to executing it immediately after the POC.
- [ ] User confirms: "Proceed with POC-1 execution."

---

## Gate 6 — Between Subsequent POCs

**Required before executing any POC after POC-1:**

- [ ] The previous POC has been completed.
- [ ] Results have been documented in `docs/poc_results.md` (a new document to be
      created after POC-1 execution).
- [ ] Cleanup from the previous POC has been confirmed completed.
- [ ] User has reviewed the results and confirmed: "Proceed with [POC-N]."
- [ ] If any POC triggered a Scope Escalation Rule: that escalation decision must be
      reviewed and resolved before the next POC proceeds.

**What this gate protects:** Ensures each POC result is reviewed before the next
experiment begins. Prevents a chain of POC executions from running unreviewed.

---

*End of POC Execution Plan.*

*No POC has been executed. No Google account has been accessed. No Google API has been*
*called or enabled. No OAuth credentials have been created. No application code has been*
*written. No test data has been created or accessed.*
