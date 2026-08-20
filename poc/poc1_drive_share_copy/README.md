# POC-1: Drive Picker + Share + Copy Scope Test Harness

This folder contains the **isolated, minimal test harness** for executing **POC-1**.

## Primary Objective
Test whether two personal consumer Google accounts can complete the **share-then-copy** migration workflow using **only the candidate `drive.file` scope** (Non-sensitive), when the source file is selected via the official **Google Drive Picker**.

## Simplified File-Based Local Configuration
- **No `.env` Copy-Pasting Required:** The harness automatically parses your downloaded `credentials.json` from Google Cloud Console.
- **OAuth Flow:** Uses official **Google Identity Services (GIS) Token Client** (`google.accounts.oauth2.initTokenClient`) in the browser.
- **No Client Secret Used:** Web Application flow with GIS uses the browser token model and does not use or expose any client secret.
- **Zero External Dependencies:** A lightweight 80-line native Node.js HTTP server (`src/server.js`) serves the local static UI and reads the local config files.
- **No Token Persistence:** Tokens are held strictly in browser JavaScript runtime memory and never saved to disk.
- **No Broad Scopes:** Only requests `https://www.googleapis.com/auth/drive.file`.

## Directory Structure
```
poc/poc1_drive_share_copy/
├── credentials.json          # (Local) Downloaded OAuth Web Client JSON from Google Cloud Console (gitignored)
├── picker-config.json        # (Local) Your Google Picker API Key (gitignored)
├── credentials.example.json  # Reference template for credentials.json
├── picker-config.example.json# Reference template for picker-config.json
├── .gitignore                # Excludes credentials.json, picker-config.json, .env
├── package.json              # Zero external dependencies
├── README.md                 # This file
├── SETUP_REPORT.md           # Comprehensive setup & execution guide
└── src/
    ├── public/
    │   └── index.html        # Client-side GIS + Google Picker test runner
    └── server.js             # Native HTTP server serving UI and config
```

## Quick Start (After Cloud Setup)
1. Download the OAuth Web Client JSON from Google Cloud Console and save it directly as:
   ```
   poc/poc1_drive_share_copy/credentials.json
   ```
2. Create `picker-config.json` containing your Google Picker API Key:
   ```json
   {
     "apiKey": "YOUR_API_KEY"
   }
   ```
3. Start the local server:
   ```bash
   npm start
   ```
4. Open **`http://localhost:3000`** in your browser.
