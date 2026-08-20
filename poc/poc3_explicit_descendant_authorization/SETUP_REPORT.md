# POC-3 Setup Report: Explicit Descendant Authorization Workaround

**Project:** Google Account Migration Tool  
**Experiment:** POC-3 (Explicit Descendant Authorization under `drive.file`)  
**Status:** HARNESS CREATED — AWAITING USER APPROVAL & DATA CREATION BEFORE EXECUTION  

---

## 1. Files Created in `poc/poc3_explicit_descendant_authorization/`

| File | Purpose |
| :--- | :--- |
| [`POC_PLAN.md`](POC_PLAN.md) | Comprehensive test plan defining Tests A, B, C, D and UX evaluation metrics. |
| [`README.md`](README.md) | Experiment overview, directory structure, and setup instructions. |
| [`SETUP_REPORT.md`](SETUP_REPORT.md) | This setup verification report. |
| [`package.json`](package.json) | Zero-dependency Node.js configuration. |
| [`credentials.json`](credentials.json) | Local OAuth Web Client ID configuration (gitignored). |
| [`picker-config.json`](picker-config.json) | Local Google Picker API Key (gitignored). |
| `src/server.js` | Native HTTP server (port 3000) serving the test UI and config. |
| `src/public/index.html` | Step-by-step interactive test runner implementing Tests A, B, C, and D. |

---

## 2. Exact APIs & Endpoints Used

| API | HTTP Method & Endpoint | Purpose |
| :--- | :--- | :--- |
| **Google Picker API** | Client-side JS SDK (`DocsView`, `PickerBuilder`) | Explicit user selection of root folder and descendant files. |
| **Google Identity Services** | Client-side JS SDK (`initTokenClient`) | Browser runtime token generation under `drive.file`. |
| **Google Drive API v3** | `GET https://www.googleapis.com/drive/v3/files?q=...` | Descendant discovery via `files.list`. |
| **Google Drive API v3** | `POST https://www.googleapis.com/drive/v3/files/{id}/permissions` | Sharing files with Account B (`permissions.create`). |
| **Google Drive API v3** | `POST https://www.googleapis.com/drive/v3/files` | Creating destination folders in Account B (`files.create`). |
| **Google Drive API v3** | `POST https://www.googleapis.com/drive/v3/files/{id}/copy` | Server-side copying files into destination folders (`files.copy`). |
| **Google Drive API v3** | `GET https://www.googleapis.com/drive/v3/files/{id}` | Read-only audit verification (`files.get`). |

---

## 3. Exact OAuth Scope Used

* **Scope Declared & Requested:**  
  `https://www.googleapis.com/auth/drive.file`
* **Broader Scopes Added:** **NONE (0)**  
  *(No `drive`, no `drive.readonly`, no `drive.metadata.readonly`, no Gmail/Photos scopes)*.

---

## 4. User Actions Required for Each Test

### Synthetic Data Setup (in Account A):
Create in Account A's Drive web interface:
```text
POC3_ROOT/
├── root_file.txt
├── folder_A/
│   ├── file_A1.txt
│   └── file_A2.txt
└── folder_B/
    └── file_B1.txt
```

### Execution Steps in Test Harness:
1. **0. Auth:** Connect Account A and Account B.
2. **Test A (Folder Boundary):** Click **Select POC3_ROOT in Picker**, then click **Execute Test A** to attempt sharing an unselected descendant and record the exact HTTP response without prejudice.
3. **Test B (Single File Auth):** Click **Select file_A1.txt in Picker**, then click **Execute Test B** to test sharing and copying that single explicitly authorized descendant.
4. **Test C (Multi-File Auth):** Click **Multi-Select Descendant Files in Picker**, select `file_A2.txt`, `file_B1.txt`, and `root_file.txt`, then click **Execute Test C** to verify independent authorization across all items.
5. **Test D (End-to-End Migration):** Recreate destination folders, copy authorized files into mapped destination folders, and generate the final audit report and UX evaluation.

---

## 5. Formal Confirmations

* ✅ **Only `drive.file` is requested:** Confirmed.
* ✅ **No broader scope was added:** Confirmed.
* ✅ **Zero file bytes downloaded or streamed:** Confirmed (Zero Data Plane).
* ✅ **NO TEST HAS YET BEEN EXECUTED:** Confirmed.
