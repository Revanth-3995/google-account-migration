# POC-1 Setup Report & Execution Guide (Automatic File-Based Configuration)

**Project:** Google Account Migration Tool  
**Experiment:** POC-1 (Drive Picker + Share + Copy Scope Test)  
**Date:** 2026-08-17 (Updated for Prompt 4.2)  
**Status:** HARNESS CONFIGURED FOR AUTOMATIC FILE PARSING. READY FOR MANUAL SETUP. NOT YET EXECUTED.

---

> [!IMPORTANT]
> **Zero-Execution Confirmation:**
> - No POC has been executed by Antigravity.
> - No Google account has been authenticated or connected by Antigravity.
> - No Google API has been enabled or called by Antigravity.
> - No Google Cloud project or OAuth credentials have been created by Antigravity.
> - All code in `poc/poc1_drive_share_copy/` is a local test harness waiting for manual setup and your explicit execution.

---

## 1. Local Configuration File Specifications

Instead of manually editing `.env` files, the harness automatically loads configuration from two local JSON files:

### 1.1 `credentials.json` (Downloaded from Google Cloud Console)
- **Path:** `poc/poc1_drive_share_copy/credentials.json` (Gitignored)
- **Reference Template:** [`poc/poc1_drive_share_copy/credentials.example.json`](credentials.example.json)
- **Expected Standard Google Format:**
  ```json
  {
    "web": {
      "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
      "project_id": "poc1-drive-migration-test",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_secret": "...",
      "redirect_uris": [],
      "javascript_origins": ["http://localhost:3000"]
    }
  }
  ```
- **Field Extracted by Server:** `client_id` (from `web.client_id` or `installed.client_id`).
- **Field Exposed to Browser:** `clientId` only.
- **Client Secret Handling:** `client_secret` is completely ignored by the server and never sent to the browser or used in any request.

### 1.2 `picker-config.json` (Google Picker API Key)
- **Path:** `poc/poc1_drive_share_copy/picker-config.json` (Gitignored)
- **Reference Template:** [`poc/poc1_drive_share_copy/picker-config.example.json`](picker-config.example.json)
- **Expected Format:**
  ```json
  {
    "apiKey": "YOUR_GOOGLE_PICKER_API_KEY"
  }
  ```
- **Field Extracted by Server:** `apiKey`.
- **Field Exposed to Browser:** `apiKey` (used solely to initialize the Google Picker JS builder).

---

## 2. API Key Security & Localhost Restrictions

The **API Key** is used exclusively by the client-side Google Picker SDK (`setDeveloperKey(apiKey)`):
- **It is NOT an OAuth secret** and cannot access user data by itself.
- **Recommended Cloud Console Restriction:**
  - In Cloud Console > Credentials > Edit API Key:
  - **API restrictions:** Select *Restrict key* -> check only **Google Picker API**.
  - **Application restrictions:** Select *Websites* -> add `http://localhost:3000/*` and `http://localhost:3000`.

---

## 3. Step-by-Step Google Cloud Console Setup Instructions

Please perform the following actions manually in the [Google Cloud Console](https://console.cloud.google.com/):

### Step A: Create Dedicated Test Project
1. Open the [Google Cloud Project Creator](https://console.cloud.google.com/projectcreate).
2. Project name: `poc1-drive-migration-test` (or similar clear name).
3. Organization: `No organization` (personal account).
4. Click **Create** and ensure the project is selected in the top navbar.

### Step B: Enable Required APIs Only
1. Navigate to **APIs & Services > Library**.
2. Search for `Google Drive API` -> Click **Enable**.
3. Search for `Google Picker API` -> Click **Enable**.
4. ❌ *Do not enable any other APIs.*

### Step C: Configure OAuth Consent Screen
1. Navigate to **APIs & Services > OAuth consent screen**.
2. User Type: Select **External** -> Click **Create**.
3. Fill App Info:
   - App name: `POC1 Drive Scope Test`
   - User support email: Select your disposable account email.
   - Developer contact email: Enter your disposable account email.
   - Click **Save and Continue**.
4. In **Scopes**:
   - Click **Add or Remove Scopes**.
   - Search for `drive.file`.
   - Check `.../auth/drive.file` (`https://www.googleapis.com/auth/drive.file`).
   - ❌ *Do not select `drive.readonly` or `drive`.*
   - Click **Update** -> Click **Save and Continue**.
5. In **Test users**:
   - Click **Add Users**.
   - Add **Account A** (disposable email).
   - Add **Account B** (disposable email).
   - Click **Save and Continue**.
6. Review Summary and return to Dashboard.

### Step D: Create & Download Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Name: `POC1 Web Client`
   - **Authorized JavaScript origins**: Add `http://localhost:3000`
   - **Authorized redirect URIs**: (Optional / leave blank; GIS uses in-browser popup model)
   - Click **Create**.
3. In the OAuth Clients list, click the **Download JSON** icon on your newly created Web client.
4. Save the downloaded file directly as:
   ```
   poc/poc1_drive_share_copy/credentials.json
   ```
5. Click **Create Credentials > API key**:
   - Copy the generated API key.
6. Create `poc/poc1_drive_share_copy/picker-config.json`:
   ```json
   {
     "apiKey": "PASTE_YOUR_API_KEY_HERE"
   }
   ```

---

## 4. Local Execution Guide

In your terminal:
```bash
cd "poc/poc1_drive_share_copy"

# Start the local static server
npm start
```
Open **`http://localhost:3000`** in your browser.

### Step-by-Step Execution Sequence in UI
1. **Synthetic Data**: In Account A's Drive web interface, manually upload or create one text file `poc1_test_file.txt` with dummy text.
2. **Step 1**: Click **Connect Account A** -> In GIS popup, sign in as Account A and approve `drive.file`.
3. **Step 2**: Click **Open Google Drive Picker** -> Select `poc1_test_file.txt`.
4. **Step 3**: Click **Verify File Metadata** -> Confirms `drive.files.get` reads metadata for selected file.
5. **Step 4**: Enter Account B email and click **Execute Share (permissions.create)** -> Grants Account B read access.
6. **Step 5**: Click **Connect Account B** -> In GIS popup, sign in as Account B and approve `drive.file`.
7. **Step 6**: Click **Execute Copy (files.copy)** -> Creates copy in Account B's Drive.
8. **Step 7**: Click **Verify Copy Ownership** -> Confirms Account B is `owner` of the copy.

---

## 5. Stop Conditions & Rules
- **Stop if scope error on share or copy:** `drive.file` was insufficient under this configuration. Do NOT add scopes. Record error payload.
- **Stop if consent screen demands broad access.**
- **Stop if Picker fails to initialize.**

---

## 6. Status & Confirmations

| Item | Status |
|---|---|
| **Gitignore Protection** | ✅ `credentials.json` and `picker-config.json` are in `.gitignore` |
| **Client Secret Usage** | ✅ **NONE** (Client secret ignored by server, never sent to browser) |
| **POC Execution** | ❌ **NOT EXECUTED** |
| **Google Accounts Authenticated** | ❌ **NONE** |
| **Google APIs Called / Enabled** | ❌ **NONE** |
| **Credentials Created by Antigravity** | ❌ **NONE** |
