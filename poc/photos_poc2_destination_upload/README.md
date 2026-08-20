# PHOTOS-POC-2 Setup Report: Destination Upload & In-Memory Relay

**Project:** Google Account Migration Tool  
**Experiment:** PHOTOS-POC-2  
**Status:** HARNESS CREATED — AWAITING API ACTIVATION & USER APPROVAL  

---

## 1. Configured Guardrails & Scopes
* **Account A (Source):** `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
* **Account B (Destination):** `https://www.googleapis.com/auth/photoslibrary.appendonly`
* **Strictly Prohibited:** `photoslibrary.readonly`, full `photoslibrary`, Drive scopes, Gmail scopes.
* **Disk Persistence:** Strictly 0 bytes written to disk.

---

## 2. Cloud Console Preconditions
1. Enable **Photos Library API** in Google Cloud Console (`drive-storage-manager-505102`).
2. Ensure both `anonymousxyzuzer@gmail.com` (Account A) and `crazyboyrevu@gmail.com` (Account B) are listed as Test Users.
