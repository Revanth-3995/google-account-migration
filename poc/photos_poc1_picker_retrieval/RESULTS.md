# PHOTOS-POC-1 Results: Source Selection & In-Memory Retrieval Feasibility

**Project:** Google Account Migration Tool  
**Experiment:** PHOTOS-POC-1 (Google Photos Picker Selection & In-Memory Retrieval)  
**Status:** 100% VERIFIED  
**Date Executed:** 2026-08-19  

---

## 1. Executive Summary

PHOTOS-POC-1 conclusively demonstrates that **source-side media selection, session management, descriptor extraction, and full-resolution in-memory byte/EXIF retrieval are 100% technically viable under the non-restricted `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` scope**.

---

## 2. Empirical Execution Evidence

### Step 1: Authentication & Scope Verification
* **Scope Granted:** `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
* **Account:** Account A (`anonymousxyzuzer@gmail.com`)
* **OAuth Tier:** Standard testing mode (Zero CASA / Restricted Scope hurdles).

### Step 2: Session Creation (`POST /v1/sessions`)
* **HTTP Status:** `200 OK`
* **Session ID:** `2ea3dc54-f352-4d9d-a667-1b497bdf4e52`
* **Picker URI:** `https://photos.google.com/integration/picker/auth/...`
* **Expiry:** `2026-08-26T08:45:52Z`

### Step 3: User Selection & Session Polling
* **User Interaction:** User opened Google's official Photos Picker UI and selected `IMG_20260808_162502885_HDR.jpg`.
* **Polling Status:** Detected `mediaItemsSet: true` on attempt 1.

### Step 4: Picked Media Item Descriptors (`GET /v1/mediaItems`)
* **HTTP Status:** `200 OK`
* **Items Retrieved:** 1 item
* **Metadata Extracted:**
  * **Filename:** `IMG_20260808_162502885_HDR.jpg`
  * **Dimensions:** 2304 x 1728 px
  * **Camera Hardware:** `motorola moto g62 5G`
  * **Photo Parameters:** Focal Length 3.27mm, f/2.4, ISO 100, Exposure 0.00189s
  * **Base URL:** `https://lh3.googleusercontent.com/ppa/AFv4vnpqncb8a5tUIecNkZFq7MhIjOE-787j1A0uNtbopAdRr3hexXaOE5w1rxSiNnG2efA4KGbA`

### Step 5: In-Memory Byte & EXIF Probe (`GET ${baseUrl}=d`)
* **HTTP Status:** `200 OK`
* **Binary Size Received:** **1,323,389 bytes (1,292.37 KB)**
* **Transfer Speed:** 1822 ms
* **Binary Integrity Audit:** `isJpegBinaryValid: true` (0xFF 0xD8 JPEG SOI marker confirmed)
* **EXIF Segment Audit:** `hasExifSegment: true` (Offset 24, `Exif\0\0` header confirmed)
* **Zero Disk Persistence:** Verified (Buffer retained in RAM only; 0 bytes written to disk).

### Step 6: Session Cleanup (`DELETE /v1/sessions/{id}`)
* **HTTP Status:** `200 OK` (Resources deleted on Google servers).

---

## 3. Privacy, Scope & Security Audit

| Parameter | Result |
| :--- | :--- |
| **OAuth Scope** | `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` exclusively |
| **Restricted Scopes Used** | **NONE (0)** *(No `photoslibrary.readonly`)* |
| **Bytes Persisted to Disk** | **0 bytes** (Zero disk writes) |
| **Data Plane Architecture** | **In-Memory Ephemeral Byte Stream** |
| **Unselected Photos Accessed** | **NO** (Strictly isolated to picked photo) |
| **Source Data Modified / Deleted** | **NO** |

---

## 4. Final Architecture Verdict

**STATUS:** **100% VERIFIED — READY FOR PHOTOS-POC-2 (DESTINATION UPLOAD)**

* Google Photos source selection and full-resolution byte retrieval with intact EXIF metadata is completely supported under the official Google Photos Picker API.
* Next Phase: Proceed to **PHOTOS-POC-2** to verify destination Account B upload (`photoslibrary.appendonly`) and EXIF preservation in Account B's library.
