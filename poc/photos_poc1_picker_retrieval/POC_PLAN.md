# PHOTOS-POC-1: Official Picker Selection and Retrieval Feasibility Plan

**Document:** `docs/photos_poc1_plan.md`  
**POC ID:** PHOTOS-POC-1 — Official Picker Selection and Retrieval Feasibility  
**Priority:** P0 — Architecture blocker  
**Status:** PLANNING DRAFT (VALIDATED) — NOT EXECUTED  
**Date:** 2026-08-19  

---

## 1. Primary Objective & Exact Question Being Tested

### Primary Question:
> "Using the official Google Photos Picker flow, can Account A explicitly select one test photo, and after selection what exact access, identifiers, metadata, byte-retrieval mechanism, OAuth scopes, API requirements, and policy constraints are available to the application?"

### Secondary Observations:
- What is the structure of the returned `PickedMediaItem` descriptor (`id`, `baseUrl`, `mediaFile`, `mediaMetadata`)?
- Does fetching bytes from `${baseUrl}=d` with `Authorization: Bearer <token>` deliver the raw binary stream with intact EXIF headers?
- What is the expiration window of the temporary retrieval URL provided by the Picker session (officially documented as 60 minutes)?

---

## 2. Why This POC Matters

The Google Photos migration architecture differs fundamentally from Google Drive:
* **Drive:** Supports server-to-server `files.copy` under `drive.file` with Zero Data Plane (0 bytes passing through local machine).
* **Photos:** Does NOT support cross-account permission sharing or server-to-server copying. Programmatic migration must rely on explicit Picker selection and in-memory byte transfer.

### Comparative Architectural Outcomes:
* **Outcome A (Direct Reference Pass-Through):** Proven unsupported by Google Photos API design.
* **Outcome B (In-Memory Ephemeral Byte Relay):** Picker grants `baseUrl`; app streams bytes directly in memory from Account A to Account B's upload endpoint with 0 disk persistence. *(Target Architecture).*
* **Outcome C (Scope / Policy Escalation):** If retrieval requires deprecated `photoslibrary.readonly`, migration is blocked.
* **Outcome D (Architecture Incompatible):** Photos migration is dropped in favor of Google Takeout.

---

## 3. Related Open Questions

* **OQ-P-01:** Google Photos Picker Web API session-polling model.
* **OQ-P-02:** Minimum OAuth scope classification for Google Photos Picker (`photospicker.mediaitems.readonly`).
* **OQ-P-03:** Media byte download feasibility and bandwidth/quota limits.
* **OQ-P-04:** EXIF metadata (timestamps, GPS, camera model) preservation on retrieval.
* **OQ-P-07:** Google Photos API Terms of Service compliance for migration use cases.
* **OQ-P-09 (Proposed):** Verification of ephemeral `PickedMediaItem.id` lifecycle and session isolation.

---

## 4. Preconditions (Planning Only — Nothing Created Yet)

### A. Google Cloud Requirements:
* A valid Google Cloud Project with the `Google Photos Picker API` enabled.
* Authorized JavaScript Origins configured for `http://localhost:3000`.

### B. API Requirements:
* **Google Photos Picker API** (`photospicker.googleapis.com`) (Status: **NOT YET ENABLED**).

### C. OAuth Requirements:
* OAuth 2.0 Web Client ID configured for browser-based GIS authentication.

### D. Test User Requirements:
* Account A added as an Authorized Test User in Google Cloud Console OAuth Consent Screen.

### E. Synthetic Data Requirements:
* Exactly one synthetic test image uploaded to Account A's Google Photos library (`test_photo_synthetic.jpg` with known EXIF GPS/timestamp).

---

## 5. Test Accounts

* **Source Account A:** Disposable personal consumer Google account (`anonymousxyzuzer@gmail.com`).
* **Destination Account B:** **NOT REQUIRED** for PHOTOS-POC-1.

---

## 6. Test Data

* **Dataset:** Exactly **ONE (1)** synthetic JPEG image (`test_photo_synthetic.jpg`, ~500 KB).
* **EXIF Metadata:** Embedded GPS coordinates (`37.4220° N, 122.0841° W`), Camera Model (`SyntheticTestCam-v1`), and DateTimeOriginal (`2024:05:01 12:00:00`).
* **Videos:** Excluded from POC-1.

---

## 7. Proposed Google APIs

| API Name | Service Endpoint | Purpose | Status |
| :--- | :--- | :--- | :--- |
| **Google Photos Picker API** | `photospicker.googleapis.com` | Creates picking sessions, hosts user selection UI, returns `PickedMediaItem` descriptors and `baseUrl`. | **NOT YET ENABLED** |
| **Google Photos Library API** | `photoslibrary.googleapis.com` | Media creation / destination upload (`appendonly`). | **DEFERRED TO POC-2** |

---

## 8. Proposed OAuth Scopes

| Scope URI | Classification | Status | Rationale | Candidate Type |
| :--- | :--- | :--- | :--- | :--- |
| `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` | **Non-Sensitive / Sensitive** (Picker-specific) | Officially Verified | Authorizes session creation, polling, and media item retrieval via Picker. | **Primary Candidate** |
| `https://www.googleapis.com/auth/photoslibrary.readonly` | ❌ **RESTRICTED / REMOVED** | Deprecated March 2025 | Broad library read access. | **PROHIBITED** |

---

## 9. Exact Test Flow (Sequence for Future Execution)

1. **Step 1 — Authenticate:** Account A authenticates with GIS under `photospicker.mediaitems.readonly`.
2. **Step 2 — Create Session:** Application sends `POST https://photospicker.googleapis.com/v1/sessions` &rarr; captures `sessionId` and `pickerUri`.
3. **Step 3 — User Selection:** User opens `pickerUri` in a browser popup/window, selects `test_photo_synthetic.jpg`, and confirms.
4. **Step 4 — Poll Status:** Application polls `GET https://photospicker.googleapis.com/v1/sessions/{sessionId}` until `mediaItemsSet: true`.
5. **Step 5 — Retrieve Items:** Application calls `GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={sessionId}` to obtain `PickedMediaItem`.
6. **Step 6 — Inspect Metadata:** Record returned fields (`id`, `createTime`, `type`, `mediaFile.baseUrl`, `mediaMetadata.width`, `mediaMetadata.height`).
7. **Step 7 — Byte Probe (In-Memory Only):** Application performs `GET ${baseUrl}=d` with `Authorization: Bearer <tokenA>` into an in-memory `ArrayBuffer`.
8. **Step 8 — EXIF Audit:** Probe the in-memory binary for EXIF headers (`GPSLatitude`, `GPSLongitude`, `DateTimeOriginal`).
9. **Step 9 — Immediate Evacuation:** Discard the `ArrayBuffer` from RAM. (0 bytes written to disk).
10. **Step 10 — Session Cleanup:** Call `DELETE https://photospicker.googleapis.com/v1/sessions/{sessionId}`.

---

## 10. Explicit User Actions

1. Click **"Connect Account A (Photos)"**.
2. Grant requested `photospicker.mediaitems.readonly` scope.
3. Click **"Open Google Photos Picker"**.
4. In Google's Picker UI, select `test_photo_synthetic.jpg` and click **"Done"**.

---

## 11. Data Access Boundary & Zero Data Plane Implications

* **Allowed:** Session management, inspecting metadata of selected photo, temporary in-memory byte probing.
* **Never Allowed:** Accessing unselected photos, disk persistence of media bytes, modifying or deleting source photos.
* **Data Plane Architectural Finding:** Because Google Photos lacks server-to-server copy, the architecture must operate as an **In-Memory Ephemeral Byte Relay** (RAM-only streaming from Source `baseUrl` to Destination upload endpoint, 0 disk storage).

---

## 12. Success Criteria

* ✅ Session creation returns valid `pickerUri`.
* ✅ User selection successfully populates `mediaItemsSet: true`.
* ✅ `mediaItems.list` returns `PickedMediaItem` with valid `baseUrl`.
* ✅ `GET ${baseUrl}=d` successfully downloads bytes into memory with HTTP 200.
* ✅ In-memory binary audit confirms intact EXIF headers.
* ✅ 0 bytes persisted to local disk.

---

## 13. Failure Criteria

* ❌ `sessions.create` or `pickerUri` fails for consumer Gmail accounts.
* ❌ `mediaItems.list` does not provide a functional `baseUrl`.
* ❌ `baseUrl` download fails without Restricted `photoslibrary` scopes.
* ❌ Retrieved byte stream is stripped of EXIF timestamps/GPS.

---

## 14. Scope Escalation Rule

If `photospicker.mediaitems.readonly` fails:
1. Record exact HTTP status and error response.
2. **STOP IMMEDIATELY.**
3. **DO NOT** request `photoslibrary.readonly`.
4. Return finding for review.

---

## 15. Architecture Decision Matrix

| Finding / Outcome | Evidence Required | Privacy Impact | Scope Impact | Effect on Final MVP Architecture |
| :--- | :--- | :--- | :--- | :--- |
| **Outcome B (Verified Target): In-Memory Ephemeral Stream** | `${baseUrl}=d` yields full-resolution bytes with EXIF in RAM. | Ephemeral RAM stream (0 disk storage). | `photospicker.mediaitems.readonly` (Non-sensitive / Sensitive). | Photos migration uses local chunked pipe: Source `baseUrl` &rarr; RAM buffer &rarr; Destination upload endpoint. |
| **Outcome C: Restricted Scope Blocker** | Retrieval fails without `photoslibrary.readonly`. | High (Broad access required). | Restricted Scope tier (CASA blocker). | Photos programmatic migration dropped; use Takeout / Partner Sharing. |
| **Outcome D: Picker Incompatible** | Session creation or selection fails on consumer accounts. | None. | N/A | Photos migration declared non-viable. |

---

## 16. Why Destination Upload is NOT Tested in PHOTOS-POC-1

Destination upload to Account B is deliberately excluded from this test because **source selection and byte retrieval represent the foundational unknown**. Only after source retrieval fidelity is proven will destination upload be tested in PHOTOS-POC-2.

---

## 17. Recommended Execution Path After This Plan

```
Step 1: Review and approve validated plan & validation report
   ↓
Step 2: Enable Google Photos Picker API in Google Cloud Console
   ↓
Step 3: Build minimal isolated harness (poc/poc4_photos_picker_retrieval/)
   ↓
Step 4: Execute PHOTOS-POC-1 on 1 synthetic photo
   ↓
Step 5: Document findings in RESULTS.md
   ↓
Step 6: Plan PHOTOS-POC-2 (Destination Account B Upload & EXIF Preservation)
   ↓
Step 7: Final Unified Architecture Plan (Drive + Photos Consolidation)
   ↓
Step 8: Begin MVP Implementation
```
