# Research Findings — Official Google Documentation

**Project:** Google Account Migration Tool  
**Version:** 1.0 — Prompt 2 Research Output  
**Date:** 2026-08-17  
**Status:** Research complete for Phase R-1 through R-3 priority questions.

---

> [!IMPORTANT]
> These findings are based on official Google documentation and developer resources
> researched on 2026-08-17. Google APIs, scope classifications, and policies change
> over time. Before implementation begins, each finding tagged ⚠️ **Verify at
> implementation time** should be re-checked against current documentation.

> [!NOTE]
> **No Google account was accessed. No Google API was called. No OAuth flow was
> initiated. No credentials were created. No file content, email, Drive data, or
> Photos data was read or written.**

---

## Phase R-1 — Legal and Policy Findings

---

### OQ-L-01 — Does Google ToS permit cross-account Drive migration?

**Status: ✅ No specific prohibition found — permitted with conditions**

**Findings:**

The Google APIs Terms of Service (last modified November 2021) does not contain
a specific prohibition against using the Drive API to copy files from one personal
account to another personal account owned by the same individual.

Key relevant clauses:
- **Permitted Access (§2c):** You must access APIs only by the means described in
  the documentation. The Drive `files.copy` and `permissions.create` methods are
  documented mechanisms — using them is permitted.
- **Compliance with Law (§2b):** No law violation in helping a user transfer their
  own files.
- **No specific prohibition** on personal-to-personal account file transfer found
  in the API ToS.

**Conditions that must be met:**
- Must use documented API methods only (no scraping, no undocumented endpoints).
- Must respect rate limits and quotas.
- Must comply with the Google API Services User Data Policy (see OQ-D-06 below).

**Source:** https://developers.google.com/terms

---

### OQ-P-07 — Does Google Photos ToS permit third-party migration tools?

**Status: ✅ No specific prohibition — but critical policy constraints apply**

**Findings:**

The Google API Services User Data Policy explicitly prohibits certain uses of data
obtained through Google APIs. For our use case, the following apply:

**PROHIBITED — must ensure we never do these:**
- Using user data for advertising or retargeting — ❌ we will not do this.
- Selling user data to third parties — ❌ we will not do this.
- Using user data to train AI/ML models — ❌ we will not do this.
- Allowing humans on our side to read user data — ❌ no human inspection of
  media bytes; our server is a pass-through only.

**PERMITTED — our use case:**
- Accessing and transferring user data at the user's explicit direction, for the
  user's own benefit, is the core permitted use case.
- The Policy states access must be limited to providing features that are prominent
  in the application's UI — our migration feature is exactly that.

**Requirement:**
- A privacy policy must be published that clearly discloses data usage.
- Must declare that we do not use data for ads, AI training, or third-party sharing.

**Source:** Google API Services User Data Policy (developers.google.com/terms/api-services-user-data-policy)

---

### OQ-D-06 — OAuth app verification tiers and process

**Status: 🔴 CRITICAL BLOCKER — scope tier classification has major impact**

**Findings — Drive Scope Tiers:**

| Scope | Classification | Implication |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | **Non-sensitive** | Covers only files our app created/opened via our app's picker |
| `https://www.googleapis.com/auth/drive.readonly` | **🔴 Restricted** | Full read access to all Drive files; may require 3rd-party security assessment |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | **🔴 Restricted** | Read-only metadata for all files; restricted classification |
| `https://www.googleapis.com/auth/drive` | **🔴 Restricted** | Full read+write; must NOT be used |

**Findings — Verification Requirements:**
- **Non-sensitive scopes (`drive.file`):** Applications using only non-sensitive scopes are generally not required to complete the Google OAuth app verification process, though brand verification (for the consent screen) may still apply depending on the application's audience. ⚠️ Verify exact requirements at setup time.
- **Sensitive scopes:** Require Google review; app shows warning screen until verified.
- **Restricted scopes (like `drive.readonly`):** Require Google review AND may require an annual **third-party security assessment (CASA — Cloud Application Security Assessment)** by a Google-designated auditor if the app transmits restricted-scope user data to servers. Google does not publish a fixed cost for this assessment; the cost is agreed between the developer and the independent assessor and can create **significant cost and timeline implications**. ⚠️ Exact cost must be obtained from authorized assessors and must not be assumed from any fixed range.
- **Testing mode:** Unverified apps can operate with up to **100 test users** without completing verification.

**Critical implication for our architecture:**

The scope classification creates a fundamental architectural decision:
- If we use `drive.readonly` (Restricted) to list the user's files → formal security assessment potentially required for production → significant cost and timeline implications.
- If we use `drive.file` (Non-sensitive) only → significantly lighter verification burden → BUT `drive.file` only covers files our app created or that the user explicitly opened through our app's picker. This means we cannot silently list the user's existing Drive files — which is consistent with our privacy requirements.

**This directly affects the MVP architecture.** The viable path that avoids Restricted scopes for listing is to use the **Google Drive Picker** (a JavaScript picker widget) which operates under `drive.file` scope — the user selects files through Google's UI and our app only receives access to those selected files.

**Source:** Google Drive API authorization documentation; Google OAuth verification documentation

---

## Phase R-2 — Core Architecture Findings

---

### OQ-D-OT-01 — Ownership transfer between personal @gmail.com accounts

**Status: ✅ CONFIRMED — Supported, with important limitations**

**Findings:**

Ownership transfer between two personal `@gmail.com` accounts **IS supported** via:
1. The Google Drive UI (sharing → Transfer ownership option).
2. The Drive API's `permissions.create` with `pendingOwner: true` and `transferOwnership: true`.

**The two-step API process:**
1. Source account calls `permissions.create` with `role: 'writer'` and `pendingOwner: true` → triggers email to destination.
2. Destination account calls `permissions.update` or `permissions.create` with `role: 'owner'` and `transferOwnership: true` → transfer completes.
3. Original owner's role is automatically downgraded to `writer`.

**Critical limitations (confirmed):**
- **File-by-file only.** There is currently no API to bulk-transfer an entire folder's contents. Transferring a folder does not automatically transfer the files inside it.
- **Explicit recipient acceptance required.** The destination account must accept. This is a user-facing action.
- **NOT cross-domain.** Ownership transfer from `@gmail.com` to a Google Workspace account (or vice versa) is blocked. This is fine for our use case (personal-to-personal).
- **Shared Drives.** Ownership transfer not supported for files in Shared Drives.

**Scope requirement — correction and open question:**

The official Drive API documentation for `permissions.create` and `permissions.update` lists **both `drive` and `drive.file`** as accepted authorization scopes. This means the permission methods themselves do not mandate the full Restricted `drive` scope.

However, whether the **complete end-to-end ownership transfer flow** — including the `pendingOwner: true` initiation from Account A and the `transferOwnership: true` acceptance by Account B — works correctly for a Picker-selected file using only `drive.file` scope has **not been confirmed by documentation or POC**.

> ⚠️ **This is now explicitly an open POC question (OQ-D-OT-01-SCOPE):** Does the full personal-account ownership transfer flow work under `drive.file` scope alone for a file selected via the Drive Picker? If yes, this is potentially better news than initially assessed — the ownership transfer path would also remain Non-sensitive. This must be validated before any implementation.

**Architecture implication:**

Ownership transfer is technically viable for personal-to-personal migration:
- It requires recipient acceptance (a manual step, not fully automatable).
- It is file-by-file only (cannot bulk-transfer folders).
- After transfer, the original account retains `writer` access — source file is not deleted (consistent with our no-auto-delete rule).
- Whether it stays within the Non-sensitive `drive.file` scope is a high-value POC question.

**This is a potential MVP path for Drive, pending POC scope verification.**

**Source:** Google Drive API permissions documentation; Google Drive Help Center

---

### OQ-D-01 — `files.copy` cross-account server-side copy behavior

**Status: ✅ CONFIRMED — Viable, with required sharing pre-step**

**Findings:**

`files.copy` does NOT directly copy a file from Account A to Account B in a single API call. Google does not support this for security reasons. However, a viable two-step server-side copy is possible:

**The cross-account copy workflow:**
1. Authenticate as Account A → call `permissions.create` to share the source file with Account B's email (granting `reader` or `writer` access).
2. Authenticate as Account B → call `files.copy` on the shared file's ID → creates a new file owned by Account B.
3. Optionally: Authenticate as Account A → call `permissions.delete` to remove Account B's access to the original shared file.

**Key characteristics of `files.copy`:**
- The resulting copy is **owned by the caller** (Account B) — correct behavior for our use case.
- The copy does **NOT inherit the original file's permissions** — sharing settings are reset. This is correct behavior (destination file is private to Account B by default).
- Works for both binary files and Google-native files (Docs, Sheets, Slides).
- `files.copy` does NOT copy revision history — the copy starts fresh.
- Comments are NOT copied.
- Shared Drive files require `supportsAllDrives: true` — not needed for personal Drive.

**Quota implication:**
- The copy counts against Account B's storage quota.
- Account A's storage is unchanged.

**Scope implication:**
- Step 1 (sharing source file from Account A): Requires `drive.file` scope IF the file was opened/created via our app. For files the user selects through a Drive Picker, `drive.file` is sufficient.
- Step 2 (copying as Account B): `files.copy` on a file shared with you requires `drive.file` scope for the copy target.

**This is the primary recommended architecture for Drive binary file migration.**

**Source:** Google Drive API files.copy documentation; official code samples

---

### OQ-P-01 — Does a Google Photos Picker API exist for web?

**Status: ✅ CONFIRMED — YES, a web Picker API exists and is recommended**

**Findings:**

The **Google Photos Picker API** is an officially supported, first-class Google API for web applications. It is accessible at `https://photospicker.googleapis.com/v1/`.

**How it works (web flow):**
1. App calls `sessions.create` → receives a `sessionId` and a `pickerUri`.
2. App sends the user to the `pickerUri` (Google's own UI — the user selects photos inside Google's interface, not inside our app).
3. App polls the session using `sessionId` until `mediaItemsSet` is `true`.
4. App calls `mediaItems.list` with the `sessionId` → receives an array of `PickedMediaItem` objects.
5. Each item has: `id`, `baseUrl` (for accessing bytes), `mimeType`.

**Privacy characteristics (highly favorable for our project):**
- Our application **never sees the user's full Photos library**.
- We only receive references to items the user explicitly selected in Google's own UI.
- The `pickerUri` sends the user to Google's native picker interface — we have zero visibility into what the user does not select.
- This is the exact model we required in `privacy_and_security_rules.md` Rule DA-1.

**Required OAuth scope:**
- `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
- This scope is **specific to the Picker API** — it does not grant access to the user's broader Photos library.
- Scope classification: needs verification, but likely **Sensitive** (not Restricted) given its narrowly limited access — ⚠️ **Verify scope tier at implementation time**.

**Important note:** Google officially recommends the Picker API over the Library API for use cases that only need user-selected items.

**Source:** https://developers.google.com/photos/picker/guides/get-started-picker; Google Photos API overview navigation

---

## Phase R-3 — OAuth Scope Design Findings

---

### OQ-D-02 — Minimum Drive scopes for our use case

**Status: ✅ Answered — architecture decision now possible**

**Summary of confirmed scope capabilities:**

| Scope | Classification | What it can do | Can it list existing user files? |
|---|---|---|---|
| `drive.file` | Non-sensitive | Access only files created by our app OR opened via our app's Drive Picker | Only files user explicitly opens through our Picker |
| `drive.readonly` | **Restricted** | Read all files in Drive | Yes — all files |
| `drive.metadata.readonly` | **Restricted** | Read metadata of all files | Yes — all metadata |
| `drive` | **Restricted** | Full read+write+delete | Yes — everything |

**Architectural conclusion:**

Given that `drive.readonly` and `drive.metadata.readonly` are **Restricted** scopes that may require a formal third-party security assessment with significant cost and timeline implications, the recommended architecture for our MVP is:

**Use the Google Drive Picker widget (`drive.file` scope) — Non-sensitive.**

The Google Drive Picker is a JavaScript API (separate from the Drive REST API) that lets the user browse and select their own files using Google's native file browser. Our app receives access only to the files the user selected, under the `drive.file` scope. This:
- Avoids the Restricted scope tier entirely.
- Satisfies Rule DA-1 (no silent data access).
- Is consistent with the Picker model we already identified for Photos.
- Does not require the formal OAuth app verification process that applies to Sensitive and Restricted scopes (though brand/consent screen verification may apply — ⚠️ verify at setup time).

**For upload to destination account (Account B):**
- `drive.file` scope is sufficient to upload new files that our app creates.

**Remaining scope question:**
- Does the Google Drive Picker work for selecting files from the **source account (Account A)** when we need to then share them? ⚠️ Verify: the Picker returns fileIds; can we use those fileIds to call `permissions.create` under `drive.file` scope?

**Source:** Google Drive API authorization documentation

---

### OQ-P-02 — Minimum Photos scopes for our use case

**Status: ✅ Answered for Picker path; Library API scope tier needs verification**

**For user-selection (source account — Account A):**
- Scope: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
- This is the Picker API scope — narrow, read-only, covers only selected items.
- Does not grant access to the broader Photos library.

**For uploading media to destination account (Account B):**
- Scope: `https://www.googleapis.com/auth/photoslibrary.appendonly`
  - Allows adding photos/videos to the library but NOT reading existing items.
  - This is the minimum scope for upload.
- Alternatively: `https://www.googleapis.com/auth/photoslibrary`
  - Full library access — broader than needed for upload only.
- The `appendonly` scope is preferred — append-only means we cannot accidentally read or delete existing library content.
- Scope tier for `photoslibrary.appendonly`: ⚠️ **Verify classification** — Library API scopes are expected to be Sensitive or Restricted.

**Upload process (confirmed two-step):**
1. POST bytes to `https://photoslibrary.googleapis.com/v1/uploads` → receive upload token.
2. POST to `https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate` with the upload token → creates the media item in the library.
- Upload token is valid for **1 day** after creation.
- Supported upload sizes: photos up to **200 MB**, videos up to **20 GB**.

**Source:** Google Photos Library API upload documentation

---

## Additional Findings — Partially Answered Questions

---

### OQ-P-04 — EXIF, timestamp, and GPS metadata after upload

**Status: 🟡 Partially answered — requires POC validation for exact behavior**

**Findings from official documentation:**
- **`mediaItems:batchCreate` does not accept a `creationTime` override parameter.** The API focuses on file bytes and upload token; no timestamp override field is documented.
- **Videos:** The API documents a `videoProcessingStatus` field, confirming that videos go through a processing stage after upload before they are fully available.

**Claims requiring POC validation (not confirmed by official documentation alone):**
- Whether Google Photos reads the `DateTimeOriginal` EXIF tag and uses it as the photo's date in the destination library. This is widely expected behavior but must be verified with a test upload.
- Whether GPS/location EXIF fields survive a download-then-upload pass-through without being stripped.
- Whether EXIF preservation behavior differs across formats (JPEG, PNG, HEIC, RAW).
- What fallback date Google Photos assigns when EXIF is absent or corrupt.

> ⚠️ **These behaviors must be validated as part of the Photos POC (POC-3/POC-4 in the POC sequence). Do not treat EXIF preservation as confirmed until tested.**

**Implication regardless of POC outcome:** Our streaming pass-through code must not alter, strip, or re-encode file bytes in any way. Bytes from source must arrive at destination byte-identical to preserve whatever metadata the original file contains.

**Source:** Google Photos Library API upload documentation (official)

---

### OQ-D-OT-02 — File types that block ownership transfer (partial)

**Status: 🟡 Partially answered — key limitation confirmed**

**Key confirmed limitation:**
- **Folders do NOT recursively transfer ownership.** Transferring a folder does not transfer its contents — each file must be individually transferred.
- Third-party owned files (files shared with Account A but owned by others) cannot be ownership-transferred by Account A.
- Ownership transfer is file-by-file via API; no bulk folder mechanism exists.

**Still unclear:** Which specific MIME types are blocked from ownership transfer (if any beyond Shared Drive files). ⚠️ Requires POC validation.

---

### OQ-D-08 — Large file and resumable upload/download

**Status: ✅ Answered**

**Findings:**
- **Maximum file size:** 5 TB (personal Drive, per file).
- **Resumable uploads:** Fully supported by the Drive API. The recommended protocol for files >5 MB.
- **Resumable downloads:** Supported via `Range` headers on the download endpoint.
- **Daily upload/copy limit:** 750 GB per user per day. After hitting this, further uploads are blocked until 24 hours elapse.
- **Rate limit errors:** `403 User rate limit exceeded` or `429 Too Many Requests` — must implement exponential backoff.

---

### OQ-D-04 — Metadata loss in Google-native file export/import

**Status: 🟡 Partially answered from documentation**

**Confirmed losses in export/import cycle:**
- Revision history: **NOT preserved** — the copy starts with a single revision.
- Comments: **NOT preserved** — `files.copy` does not copy comments.
- Sharing settings: **NOT preserved** — copy is private to the destination account.
- Named ranges (Sheets): likely lost in Office format round-trip.
- Advanced formatting (Docs): may degrade in `.docx` export/re-import.

**`files.copy` for native files (alternative to export/import):**
- `files.copy` works for Google Docs, Sheets, Slides.
- Results in a Google-native file in the destination account.
- No byte streaming needed — Google handles the copy server-side.
- Still loses revision history and comments, but preserves formatting.
- **Recommended over export/import** for Google-native files.

⚠️ **POC required** to verify `files.copy` fidelity for each native file type under the two-account sharing workflow.

---

## Summary of Architecture Implications

Based on research findings, the following architectural direction is now justified:

### For Google Drive

**Primary path — Non-sensitive scope architecture (Drive Picker + `drive.file`):**

| Step | Operation | Scope Required | Classification |
|---|---|---|---|
| User selects source files | Google Drive Picker (Account A) | `drive.file` | Non-sensitive ✅ |
| Share source file with Account B | `permissions.create` (Account A) | `drive.file` | Non-sensitive — ⚠️ POC must confirm |
| Copy shared file to Account B | `files.copy` (Account B) | `drive.file` | Non-sensitive — ⚠️ POC must confirm |
| Upload new file to Account B | `files.create` (Account B) | `drive.file` | Non-sensitive ✅ |

**Current position:** The `drive.file` Non-sensitive path is the intended target architecture. Official Drive API documentation lists `drive.file` as an accepted scope for the permission methods involved. Whether this is **sufficient end-to-end** for the complete sharing-and-copy flow with Picker-selected files is the single most important POC question.

> ⚠️ **POC required** before treating the Non-sensitive Drive path as confirmed. If `drive.file` is insufficient for `permissions.create` on Picker-selected files, the scope implications must be reassessed.

### For Google Photos

**Primary path — Picker + appendonly architecture:**

| Step | Operation | Scope Required | Classification |
|---|---|---|---|
| User selects source photos | Photos Picker API (Account A) | `photospicker.mediaitems.readonly` | ⚠️ Tier not yet verified |
| Download selected media bytes | `baseUrl` from Picker (Account A) | `photospicker.mediaitems.readonly` | ⚠️ Tier not yet verified |
| Upload bytes to Account B | Photos Library API upload (Account B) | `photoslibrary.appendonly` | ⚠️ Tier not yet verified |
| Create media item in Account B | `mediaItems:batchCreate` (Account B) | `photoslibrary.appendonly` | ⚠️ Tier not yet verified |

**Current position:** The Photos Picker API exists and is privacy-compatible. The scopes required (`photospicker.mediaitems.readonly` and `photoslibrary.appendonly`) have been identified but their **OAuth verification tier classification has not yet been confirmed**. The conclusion that Photos migration avoids Restricted scopes is **conditional** on that verification.

**Note:** Unlike Drive, Photos migration **requires bytes to flow through our server** (download from Account A's Picker `baseUrl`, upload to Account B's Library API). This is a data-plane operation. Our infrastructure must handle this as a streaming pass-through with no byte persistence.

---

## Questions Now Answered

| ID | Question | Finding |
|---|---|---|
| OQ-L-01 | Drive ToS permits cross-account migration? | ✅ Yes, with conditions |
| OQ-P-07 | Photos ToS permits migration? | ✅ Yes, with User Data Policy compliance |
| OQ-D-06 | OAuth verification tier for Drive/Photos scopes | `drive.readonly` is **Restricted** — significant assessment implications. `drive.file` (Non-sensitive) via Drive Picker avoids this. ⚠️ Photos scope tiers still unverified. |
| OQ-D-OT-01 | Ownership transfer between personal accounts | ✅ Supported — two-step, file-by-file, requires destination acceptance. Scope (`drive` vs `drive.file`) is a **POC question** — docs list both as accepted. |
| OQ-D-01 | `files.copy` cross-account | ✅ Supported via share-then-copy workflow; Google-side operation; no byte streaming |
| OQ-P-01 | Photos Picker API for web | ✅ EXISTS and is officially recommended — `photospicker.googleapis.com/v1/` |
| OQ-D-02 | Minimum Drive scopes | ✅ `drive.file` (Non-sensitive) + Drive Picker is the viable MVP path for Drive |
| OQ-P-02 | Minimum Photos scopes | `photospicker.mediaitems.readonly` + `photoslibrary.appendonly` identified — ⚠️ scope tiers not yet verified |
| OQ-D-08 | Large files, resumable uploads | ✅ Drive supports resumable upload/download; 750 GB/day limit |
| OQ-P-04 | EXIF/timestamp preservation | 🟡 Partially answered from docs; exact behavior requires POC validation |

## Questions Remaining Open

| ID | Question | Status |
|---|---|---|
| OQ-D-OT-02 | Exact file types blocked from ownership transfer | ⚠️ Needs POC validation |
| OQ-D-OT-03 | Folder recursive transfer | ✅ Confirmed: NOT recursive — file-by-file only |
| OQ-D-04 | Native file copy fidelity | 🟡 `files.copy` preferred; POC needed to verify fidelity |
| OQ-D-05 | Folder traversal model | ⚠️ Needs POC — Drive Picker handles this via user selection |
| OQ-D-07 | Drive API quotas in detail | 🟡 750 GB/day confirmed; per-project request quotas need API Console review |
| OQ-P-02 (partial) | `photoslibrary.appendonly` scope tier | ⚠️ Verify in Google OAuth consent screen configuration |
| OQ-P-03 | Photos upload feasibility (upload size limits) | ✅ 200 MB photos / 20 GB videos |
| OQ-P-05 | Video transfer handling | 🟡 Supported but has processing delay (`videoProcessingStatus`) |
| OQ-P-06 | Resumability and duplicate prevention | ⚠️ Library API upload token is 1-day valid; resumable protocol TBD |
| OQ-P-08 | Partner Sharing automability | ⚠️ Likely UI-only; not relevant if we use Picker + Library API |
| OQ-I-01 | Server language | 🔵 Design decision — not yet made |
| OQ-I-02 | Hosting model | 🔵 Design decision — not yet made |
| OQ-I-03 | Streaming timeout constraints | ⚠️ Needs testing |
| OQ-I-04 | Practical rate limits for bulk migration | ⚠️ Needs testing |
| OQ-I-05 | Infrastructure cost of byte streaming | ⚠️ Needs estimation |

---

## Next Steps Recommended

The research findings now enable the following:

1. **Define the MVP POC sequence** — based on the Drive Picker + `drive.file` scope path and the Photos Picker + `photoslibrary.appendonly` path.

2. **The most critical POC is OQ-D-01 verification:** Confirm that `files.copy` works for a file shared from Account A to Account B, using only the `drive.file` scope (not `drive.readonly`). If this works, the entire Drive migration architecture stays Non-sensitive.

3. **Before any POC:** Create disposable test Google accounts. Never use real personal data in POC experiments.

4. **Do not proceed to production architecture** until the `drive.file` scope + Drive Picker path is confirmed to work end-to-end for at least one file type.

---

*No Google account was accessed. No Google API was called. No file content,
email, Drive data, or Photos data was read or written in producing this document.
Findings are from official public Google documentation unless explicitly marked
as requiring POC validation. Any claim not directly supported by official documentation
has been labeled accordingly above.*
