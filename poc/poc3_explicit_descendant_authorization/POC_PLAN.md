# POC-3 Plan: Explicit Descendant Authorization Workaround

**Project:** Google Account Migration Tool  
**Experiment:** POC-3 (Explicit Descendant Authorization under `drive.file`)  
**Status:** PLANNING DRAFT — READY FOR REVIEW BEFORE EXECUTION  
**Target Directory:** `poc/poc3_explicit_descendant_authorization/`  

---

## 1. Executive Summary & Problem Statement

### Verified Baseline Findings:
1. **POC-1 (Verified):** Under `https://www.googleapis.com/auth/drive.file`, explicit user selection of individual or multiple files via Google Drive Picker grants sufficient authorization for reading (`files.get`), sharing (`permissions.create`), and destination server-side copying (`files.copy`) owned by Account B with zero byte transit.
2. **POC-2 (Partially Verified / Blocked):** Selecting a root folder under `drive.file` grants authorization **only to the folder object itself**. Google Drive API explicitly rejects `permissions.create` on unselected descendant files and blocks parent-folder sharing with the error:
   > `"The user has not granted the app write access to the child file, which would be affected by the operation on the parent."`

### Core Objective of POC-3:
Determine whether complete folder hierarchy migration remains technically viable and UX-acceptable under the non-sensitive `drive.file` scope if descendant files receive **explicit user selection/authorization events** via the Google Drive Picker.

---

## 2. Scope Discipline Guardrails

* **Single Authorized Scope:** `https://www.googleapis.com/auth/drive.file` exclusively.
* **Strict Prohibitions:**
  * ❌ NO `https://www.googleapis.com/auth/drive` (Full Drive)
  * ❌ NO `https://www.googleapis.com/auth/drive.readonly` (Restricted)
  * ❌ NO `https://www.googleapis.com/auth/drive.metadata.readonly`
  * ❌ NO Gmail scopes or access
  * ❌ NO Google Photos scopes or access
  * ❌ NO downloading, reading, or streaming file bytes
  * ❌ NO automatic deletion of source files
* **Stop Rule:** If an operation fails under `drive.file`, capture the exact request, HTTP status, and error payload. Do NOT automatically escalate scopes.

---

## 3. Synthetic Test Data Specification

To be created manually in **Account A** (`anonymousxyzuzer@gmail.com`) before execution:

```text
POC3_ROOT/
├── root_file.txt               (Plain text file, ~1 KB)
├── folder_A/
│   ├── file_A1.txt             (Plain text file, ~1 KB)
│   └── file_A2.txt             (Plain text file, ~1 KB)
└── folder_B/
    └── file_B1.txt             (Plain text file, ~1 KB)
```

*Total Structure:* 3 folders (1 root, 2 child folders), 4 small text files across 2 depth levels.

---

## 4. Test Matrix & Execution Phases

```
+-----------------------------------------------------------------------------------+
| Phase 1: Test A (Folder Boundary)                                                 |
| - Pick POC3_ROOT -> Attempt unselected child share -> Prove 403 boundary          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 2: Test B (Single Descendant Explicit Auth)                                 |
| - Discover hierarchy -> Explicitly pick file_A1.txt -> Test share + copy          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 3: Test C (Multi-File Descendant Explicit Auth)                             |
| - Multi-select descendant files (file_A1, file_A2, file_B1) in Picker             |
| - Verify independent drive.file authorization across all picked items             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 4: Test D (End-to-End Folder Tree Migration)                                |
| - Reconstruct folder tree in Account B                                            |
| - Copy authorized files into mapped destination folders                           |
| - Verify hierarchy preservation, ownership, and zero-byte transit                 |
+-----------------------------------------------------------------------------------+
```

### Detailed Test Specifications:

#### Test A — Folder Selection Authorization Boundary
1. Account A connects with `drive.file`.
2. Selects `POC3_ROOT` via Google Drive Picker.
3. Queries descendants via `files.list`.
4. Attempts `permissions.create` directly on unselected `file_A1.txt`.
5. *Expected Result:* Reconfirms `403 appNotAuthorizedToFile`.

#### Test B — Explicit Individual File Authorization
1. App reads discovered metadata for `folder_A/file_A1.txt`.
2. User triggers Picker scoped or navigated to `file_A1.txt` to explicitly select it.
3. App calls `permissions.create` on `file_A1.txt` granting Account B `reader`.
4. Account B calls `files.copy` into mapped destination folder `folder_A`.
5. *Expected Result:* Succeeded. Verifies that explicit file selection overcomes the descendant boundary.

#### Test C — Multi-File Explicit Authorization
1. User opens Google Drive Picker with `MULTISELECT_ENABLED`.
2. User selects all remaining descendant files (`file_A2.txt`, `file_B1.txt`, `root_file.txt`) in one selection session.
3. App verifies whether each selected document in the Picker callback receives independent `drive.file` write/share authorization.
4. *Expected Result:* All multi-selected files successfully authorize.

#### Test D — Practical End-to-End Folder Migration Workflow
1. **Step 1:** Account A selects `POC3_ROOT`.
2. **Step 2:** App discovers hierarchy metadata and builds in-memory tree.
3. **Step 3:** User performs explicit multi-file authorization for the identified files.
4. **Step 4:** Account B creates destination folders (`POC3_ROOT/`, `folder_A/`, `folder_B/`).
5. **Step 5:** Account A shares all authorized files with Account B.
6. **Step 6:** Account B copies files into their corresponding mapped destination folders.
7. **Step 7:** Verify complete hierarchy, file counts, and ownership in Account B.

---

## 5. UX & Practicality Evaluation Framework

At the conclusion of Test D, the workflow will be classified into one of three UX outcomes:

| Classification | Definition | Evaluation Criteria |
| :--- | :--- | :--- |
| **Outcome A (Good MVP Path)** | User can authorize descendant files through **one single batch/multi-select interaction**. | User selects root folder for tree structure, then performs 1 multi-select in Picker to approve all contained files. Total user interactions &le; 2. |
| **Outcome B (Poor UX)** | User must manually navigate and select each subfolder or file individually. | Requires repeated Picker launches per folder level or per file. Impractical for hierarchies with > 10 files. |
| **Outcome C (Not Viable)** | Supported Picker cannot select files across multiple folders in one session, or authorization does not persist. | Technical or behavioral barrier preventing complete migration under `drive.file`. |

---

## 6. Required Evidence Output (to be recorded in `RESULTS.md`)

* **Source Hierarchy:** Root ID, folder count, file count, max depth.
* **Authorization Scope:** `https://www.googleapis.com/auth/drive.file` exclusively.
* **API Invocations Recorded:** `files.list`, `permissions.create`, `files.create`, `files.copy`, `files.get`.
* **Destination Audit:** Number of folders created, number of files copied, verified owner.
* **Privacy Guarantees:** 
  * File bytes downloaded: NO (0 bytes)
  * File bytes streamed through server: NO (0 bytes)
  * Unrelated Drive data accessed: NO
  * Source data modified/deleted: NO
* **Final Verdict:** VERIFIED / PARTIALLY VERIFIED / BLOCKED + UX Outcome A / B / C.

---

*Plan complete. Awaiting user review and authorization before harness construction and execution.*

