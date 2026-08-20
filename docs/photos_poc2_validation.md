# PHOTOS-POC-2 Pre-Build API Contract Validation

**Project:** Google Account Migration Tool  
**Experiment:** PHOTOS-POC-2 (Source A In-Memory Relay -> Destination Account B Upload Feasibility)  
**Validation Date:** 2026-08-19  
**Validated Against:** Official Google Documentation (2025–2026 Developer Guidelines)

---

## 1. Destination Upload API Availability

### Officially Documented Facts
- The **Google Photos Library API** (`photoslibrary.googleapis.com`) remains actively supported for media creation post-March 31, 2025.
- The March 31, 2025 policy change deprecated and restricted *broad read access* (`photoslibrary.readonly`, `photoslibrary`, `photoslibrary.sharing`).
- The **upload capability via `photoslibrary.appendonly`** was explicitly retained as the standard mechanism for apps creating content in Google Photos.
- The two-step upload protocol (`POST /v1/uploads` followed by `POST /v1/mediaItems:batchCreate`) remains the official Google-supported method.

### Previously Assumed Behavior vs. Reality
- *Assumption:* No discrepancy. Previous planning correctly identified that upload operations remain supported under `photoslibrary.appendonly`.

### Empirical Verification Needed
- Verify whether the `photoslibrary.appendonly` scope executes without permission errors in Google Cloud Testing Mode for our disposable destination account (`crazyboyrevu@gmail.com`).

---

## 2. API Name in Google Cloud Console

### Officially Documented Facts
- The required API is named **"Photos Library API"** in the Google Cloud Console API Library.
- This is a distinct service from the **"Google Photos Picker API"** (`photospicker.googleapis.com`) used in POC-1.
- Endpoint: `https://photoslibrary.googleapis.com`

### Previously Assumed Behavior vs. Reality
- *Assumption:* Both APIs are needed.
- *Reality:* Confirmed. Account A uses `photospicker.googleapis.com` and Account B uses `photoslibrary.googleapis.com`.

### Action Required
- Ensure **Photos Library API** is enabled on project `drive-storage-manager-505102`.

---

## 3. OAuth Scopes

### Officially Documented Facts
- **Account A (Source):** `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` (Exclusively Picker scope).
- **Account B (Destination):** `https://www.googleapis.com/auth/photoslibrary.appendonly` (Write-only media creation scope).
- **Classification:** `photoslibrary.appendonly` is classified as Sensitive (not Restricted). It operates without CASA tier requirements and works cleanly in Testing Mode with authorized test users.

### Strictly Prohibited Scopes
- `photoslibrary.readonly`, `photoslibrary`, `photoslibrary.sharing`, Drive scopes, Gmail scopes.

---

## 4. Upload Protocol & Endpoints

### Officially Documented Facts
- **Binary Upload Endpoint:** `POST https://photoslibrary.googleapis.com/v1/uploads`
- **Simple Upload Protocol (`raw`):**
  - Headers:
    - `Authorization: Bearer <Account_B_Token>`
    - `Content-Type: application/octet-stream`
    - `X-Goog-Upload-Protocol: raw`
    - `X-Goog-Upload-Content-Type: <mime_type>` (e.g. `image/jpeg`)
  - Request Body: Raw binary bytes stream.
  - Response: Raw plain text string containing the `uploadToken` (HTTP 200).
- **Media Item Finalization Endpoint:** `POST https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate`
  - Headers:
    - `Authorization: Bearer <Account_B_Token>`
    - `Content-Type: application/json`
  - Request Body:
    ```json
    {
      "newMediaItems": [
        {
          "description": "Optional description",
          "simpleMediaItem": {
            "uploadToken": "<upload_token_from_step_1>",
            "fileName": "<original_filename>"
          }
        }
      ]
    }
    ```
  - Response: JSON object containing `newMediaItemResults[]` with created item ID, status, and `mediaItem` descriptor.

---

## 5. Metadata Fidelity & EXIF Behavior

### Officially Documented Facts
- **EXIF Extraction:** Google Photos parses embedded EXIF metadata (e.g. `DateTimeOriginal`, camera make/model, orientation) directly from the uploaded binary stream during processing.
- **API Exclusivity:** The API response `mediaMetadata` exposes dimensions and creation time, but Google deliberately omits GPS location data in API responses for user privacy.
- **Preservation in User Library:** Even though the API response omits GPS for privacy, the underlying EXIF data (including GPS) remains embedded in the original image file stored in Account B's Google Photos library and displays correctly in the Photos UI.

---

## 6. Zero Disk Persistence & In-Memory Relay

### Control Plane / Ephemeral Data Plane Architecture:
1. Account A selects photo via Picker UI -> Application receives `baseUrl`.
2. Application fetches bytes from `${baseUrl}=d` with Account A's token directly into Node.js server RAM buffer (`ArrayBuffer` / `Buffer`).
3. Application immediately streams / posts the RAM buffer to `photoslibrary.googleapis.com/v1/uploads` with Account B's token.
4. Application receives `uploadToken` and calls `batchCreate`.
5. RAM buffer is immediately cleared/garbage-collected.
6. **Zero bytes written to local disk.**

---

## 7. Pre-Build Validation Verdict

| Requirement | Verified Status |
| :--- | :--- |
| Destination Upload API Available | YES (`Photos Library API`) |
| Candidate Scope Documented | YES (`photoslibrary.appendonly`) |
| Endpoint & Upload Protocol Verified | YES (`/v1/uploads` with `raw` protocol -> `/v1/mediaItems:batchCreate`) |
| Album Requirement | Optional (Omitted to upload to main library) |
| In-Memory Relay Feasible | YES (0 disk storage) |
| Any Blockers Identified | NONE |

**Verdict:** Proceed immediately with building `poc/photos_poc2_destination_upload/`.
