# Google Photos POC-1: Pre-Execution Technical Validation

**Document:** `docs/photos_poc1_validation.md`  
**Purpose:** Strict validation of `docs/photos_poc1_plan.md` against **CURRENT OFFICIAL GOOGLE DOCUMENTATION** (2025/2026 Developer Standards).  
**Status:** VALIDATION COMPLETE — AWAITING USER REVIEW BEFORE ANY HARNESS BUILD  
**Date:** 2026-08-19  

---

## 1. Officially Confirmed Facts

1. **Dedicated Service Architecture:** Google Photos uses a completely separate REST API service (`photospicker.googleapis.com`), distinct from Google Drive's JavaScript Picker (`google.picker.PickerBuilder`).
2. **Session-Polling Model:** Unlike the client-side Google Drive Picker, the Photos Picker API operates via server/REST session endpoints:
   - `POST https://photospicker.googleapis.com/v1/sessions` &rarr; returns `id` and `pickerUri`.
   - User opens `pickerUri` in a browser window to select photos.
   - Application polls `GET https://photospicker.googleapis.com/v1/sessions/{sessionId}` until `mediaItemsSet: true`.
   - Application fetches picked items via `GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={sessionId}`.
3. **March 31, 2025 Google Policy Updates:**
   - Legacy read scopes (`photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary`) were removed/deprecated by Google.
   - The **Google Photos Picker API** is Google's official, mandated mechanism for third-party media selection.
   - Upload capability under `https://www.googleapis.com/auth/photoslibrary.appendonly` remains supported for creating new media in destination libraries.

---

## 2. Scope Classification

| Scope URI | Official Classification | Verification Tier | Documented Capabilities |
| :--- | :--- | :--- | :--- |
| `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` | **Non-Sensitive / Sensitive** (Picker-specific) | Self-assessment / Testing mode (No CASA tier required for test users) | Allows creating picking sessions, checking session status, and retrieving `PickedMediaItem` descriptors (including `baseUrl`). |
| `https://www.googleapis.com/auth/photoslibrary.appendonly` | **Sensitive** | Standard verification (Testing mode supported) | Allows uploading media bytes and creating new media items in Account B. |
| `https://www.googleapis.com/auth/photoslibrary.readonly` | ❌ **RESTRICTED / REMOVED** | Restricted | Deprecated as of March 31, 2025. **STRICTLY PROHIBITED.** |

---

## 3. Exact API Requirements

* **Cloud Console API Name:** `Google Photos Picker API`
* **Root Endpoint Service:** `photospicker.googleapis.com`
* **Google Drive / GAPI Picker Involvement:** **None**. The Photos Picker uses its own distinct web flow (`pickerUri`) and REST endpoints.

---

## 4. Official Picker Flow

```
+-----------------------------------------------------------------------------------+
| 1. POST /v1/sessions (creates session -> returns sessionId & pickerUri)           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 2. User navigates to pickerUri (Official Google Photos Selection Web UI)          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 3. App polls GET /v1/sessions/{sessionId} until mediaItemsSet == true             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 4. GET /v1/mediaItems?sessionId={sessionId} (returns PickedMediaItem array)       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 5. DELETE /v1/sessions/{sessionId} (session cleanup)                              |
+-----------------------------------------------------------------------------------+
```

### Returned Data Structure:
Each `PickedMediaItem` contains:
* `id`: Ephemeral/session-scoped media item ID.
* `createTime`: Timestamp when the item was created in Google Photos.
* `type`: Media type (`PHOTO` or `VIDEO`).
* `mediaFile`:
  * `baseUrl`: URL used to access the media bytes (valid for 60 minutes).
  * `filename`: Original filename.
  * `mimeType`: Image MIME type.
* `mediaMetadata`:
  * `width`, `height`.
  * `photo`: Specific photo metadata.
  * `video`: `status` (`READY` or `PROCESSING`).

---

## 5. Selected Media Retrieval

* **Authorization Requirement:** GET requests to `baseUrl` **MUST include the OAuth Bearer token** (`Authorization: Bearer <tokenA>`).
* **Expiration:** `baseUrl` is valid for **60 minutes** from generation.
* **Download Parameters:**
  * For full-resolution download: Append `=d` parameter (e.g. `${baseUrl}=d`).
  * For videos: Append `=dv` parameter (e.g. `${baseUrl}=dv`) once `mediaMetadata.status == 'READY'`.

---

## 6. Metadata and EXIF Facts

### A. Officially Documented Facts:
* `createTime`, `width`, `height`, and `filename` are returned in the JSON payload of `mediaItems.list`.
* Direct modification or overriding of metadata (such as forcing a new timestamp on upload) is not supported by Google Photos REST endpoints; timestamps are derived from EXIF headers or upload time.

### B. Empirical Questions Requiring POC Validation:
* Does the byte stream fetched from `${baseUrl}=d` preserve intact EXIF headers (GPS coordinates, camera model, lens metadata, `DateTimeOriginal`)?
* Does downloading with `=d` yield the exact uncompressed byte size uploaded by the user?

---

## 7. Destination Upload Feasibility

* **Officially Supported Endpoint:** `POST https://photoslibrary.googleapis.com/v1/uploads` followed by `POST https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate`.
* **Scope Required for Destination:** `https://www.googleapis.com/auth/photoslibrary.appendonly`.
* **Status:** Fully documented and supported post-March 2025.
* **Separation in Plan:** Excluded from PHOTOS-POC-1; deferred to PHOTOS-POC-2.

---

## 8. Zero Data Plane Feasibility

### Critical Architectural Finding:
* **Google Photos DOES NOT provide a Google-internal server-to-server copy mechanism.** (There is no equivalent to Google Drive's `files.copy` or permission-sharing model).
* **Consequence:** True "Zero Data Plane" is **NOT TECHNICALLY POSSIBLE** for Google Photos.
* **Viable Alternative:** **In-Memory Ephemeral Byte Relay (Architecture B)**:
  * Application downloads bytes from Source `baseUrl` directly into RAM buffer / streaming pipe.
  * Streams bytes immediately to Destination Account B's upload endpoint.
  * Zero disk persistence; RAM is freed immediately upon stream termination.

---

## 9. Remaining Architecture Blockers / Questions

1. **EXIF Fidelity:** Confirmation whether `${baseUrl}=d` preserves original EXIF GPS/timestamps without stripping.
2. **Session UX:** Testing the UX of the `pickerUri` redirect / popup flow vs. embedded iframe.
3. **Upload Rate Limits:** Byte streaming throughput and quota consumption across accounts.

---

## 10. Final Decision & Classification

### Classification:
**READY TO BUILD SOURCE-SELECTION POC (PHOTOS-POC-1)**

* Source selection and byte retrieval are fully documented and supported under non-restricted `photospicker.mediaitems.readonly`.
* Destination upload has a documented path (`photoslibrary.appendonly`) that will be tested in PHOTOS-POC-2 after source retrieval is proven.
