# POC-2: Drive Folder Structure Migration Test Harness

This folder contains the **isolated, minimal test harness** for executing **POC-2**.

## Primary Objective
Determine whether a user-selected Google Drive folder structure can be discovered and recreated in Account B with complete hierarchy preservation, using **only the candidate `drive.file` scope** (Non-sensitive) without broad Drive library scanning or byte streaming.

## Core Questions Tested
1. **Descendant Discovery:** When a user selects a root folder via Google Drive Picker under `drive.file` scope, does `drive.file` authorize the application to discover its descendant subfolders and files via `files.list` query (`'folder_id' in parents and trashed = false`)?
2. **Hierarchy Reconstruction:** Can Account B recreate matching folder nodes and preserve parent-child tree mapping?
3. **Targeted File Copy:** Can Account B execute `files.copy` placing copied files directly into their mapped destination parent folders?
4. **Zero Data Plane:** Does the entire hierarchy migrate on Google's internal servers with 0 bytes passing through the local application?

## Scope Discipline Guardrail
- **Scope Used:** `https://www.googleapis.com/auth/drive.file` (Non-sensitive) exclusively.
- **No Scope Escalation:** If `files.list` cannot query descendants under `drive.file`, the exact error is captured and reported without automatically requesting `drive` or `drive.readonly`.

## Synthetic Test Data Structure (in Account A)
Before running the test, create this minimal disposable hierarchy in Account A's Drive web interface:

```text
POC2_ROOT/
├── root_file.txt
├── Folder_A/
│   ├── file_A1.txt
│   └── Nested_A/
│       └── file_A2.txt
└── Folder_B/
    └── file_B1.txt
```

## Directory Structure
```text
poc/poc2_drive_folder_migration/
├── credentials.json          # (Local) Downloaded OAuth Web Client JSON (gitignored)
├── picker-config.json        # (Local) Google Picker API Key (gitignored)
├── package.json              # Zero external dependencies
├── README.md                 # This file
├── RESULTS.md                # Generated after execution
└── src/
    ├── public/
    │   └── index.html        # Client-side GIS + Picker + Folder Hierarchy Runner
    └── server.js             # Native Node.js HTTP server (port 3000)
```

## Quick Start
1. Ensure `credentials.json` and `picker-config.json` are present in this folder.
2. Start the local server:
   ```bash
   cd "poc/poc2_drive_folder_migration"
   npm start
   ```
3. Open `http://localhost:3000` in your browser.
4. Follow the step-by-step UI sequence:
   - **Step 1:** Connect Account A (`anonymousxyzuzer@gmail.com`)
   - **Step 2:** Open Folder Picker & select `POC2_ROOT`
   - **Step 3:** Click **Discover Selected Hierarchy**
   - **Step 4:** Review the tree, check the approval box, and connect Account B
   - **Step 5:** Click **Recreate Folder Structure**
   - **Step 6:** Click **Execute File Copy**
   - **Step 7:** Click **Verify Destination Hierarchy**
