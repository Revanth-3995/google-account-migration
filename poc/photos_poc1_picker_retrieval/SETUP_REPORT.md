# PHOTOS-POC-1 Setup Report: Source Selection & In-Memory Retrieval

**Project:** Google Account Migration Tool  
**Experiment:** PHOTOS-POC-1 (Google Photos Picker Selection & Retrieval Feasibility)  
**Status:** HARNESS CREATED — AWAITING USER APPROVAL & CLOUD API ACTIVATION  

---

## 1. Files Created in `poc/photos_poc1_picker_retrieval/`

| File | Purpose |
| :--- | :--- |
| [`POC_PLAN.md`](POC_PLAN.md) | Full feasibility plan defining single-photo selection and EXIF probe. |
| [`README.md`](README.md) | Test harness overview, endpoints, and step-by-step instructions. |
| [`SETUP_REPORT.md`](SETUP_REPORT.md) | This setup verification report. |
| [`RESULTS.md`](RESULTS.md) | Evidence capture template for empirical test observations. |
| `package.json` | Zero-dependency local Node.js environment configuration. |
| `credentials.json` | Local OAuth Web Client ID configuration (gitignored). |
| `src/server.js` | Native HTTP server + API proxy for `photospicker.googleapis.com`. |
| `src/public/index.html` | Step-by-step interactive test runner. |

---

## 2. Exact API & Scope Guardrails

* **API Required:** `Google Photos Picker API` (`photospicker.googleapis.com`).
* **Scope Requested:** Exclusively `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
* **Prohibited Scopes:** `photoslibrary`, `photoslibrary.readonly`, `photoslibrary.appendonly`, Drive scopes, Gmail scopes.
* **Account Scope:** **Account A only**. (Account B is NOT involved).

---

## 3. Preconditions for Execution

1. Enable **`Google Photos Picker API`** in Google Cloud Console (`drive-storage-manager-505102`).
2. Ensure Account A (`anonymousxyzuzer@gmail.com`) is an Authorized Test User in OAuth Consent Screen.
3. Upload 1 synthetic test photo to Account A's Google Photos library.
