# Phase 5: Unified Core Architecture & MVP Implementation Plan

**Project:** Google Account Migration Tool (Google Drive & Google Photos)  
**Status:** MVP BLUEPRINT & ARCHITECTURE SPECIFICATION  
**Author:** Pair Programming Agent  
**Date:** 2026-08-19  

---

## 1. Executive Summary & Verified Baseline

All 5 core feasibility experiments have been empirically verified with 100% success using disposable test accounts (`anonymousxyzuzer@gmail.com` and `crazyboyrevu@gmail.com`):

| Service | Mechanism | Scopes Used | Data Plane Architecture | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **Google Drive Files** | Direct Picker Select &rarr; Share &rarr; `files.copy` | `drive.file` | **Zero Data Plane** (Google Server-to-Server) | ✅ **100% Verified (POC-1)** |
| **Google Drive Folders** | Descendant Batch Multiselect &rarr; Tree Reconstruction &rarr; Mapped Copy | `drive.file` | **Zero Data Plane** (Google Server-to-Server) | ✅ **100% Verified (POC-3 Outcome A)** |
| **Google Photos Source** | Official Picker UI &rarr; Polling &rarr; Metadata & Binary Retrieval | `photospicker.mediaitems.readonly` | **In-Memory Ephemeral** (RAM only) | ✅ **100% Verified (PHOTOS-POC-1)** |
| **Google Photos Destination** | Stream RAM &rarr; `/v1/uploads` &rarr; `mediaItems:batchCreate` | `photoslibrary.appendonly` | **In-Memory Ephemeral** (0 disk bytes) | ✅ **100% Verified (PHOTOS-POC-2)** |

---

## 2. Core Architectural Principles (Non-Negotiable)

1. **Least-Privilege Scopes Only (No CASA / No Restricted Scopes):**
   * Drive: `https://www.googleapis.com/auth/drive.file` (Sensitive)
   * Photos Source: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` (Sensitive)
   * Photos Destination: `https://www.googleapis.com/auth/photoslibrary.appendonly` (Sensitive)
   * **Zero** restricted scopes (`drive`, `drive.readonly`, `photoslibrary`, `photoslibrary.readonly`).
2. **Zero Disk Media Persistence:**
   * Drive file bytes *never* touch the host machine (server-side copy).
   * Photos media bytes pass exclusively through ephemeral RAM buffers and are immediately released after upload.
   * Local SQLite database stores *only* metadata, job state, IDs, and logs—never file contents.
3. **Local Control Plane Only:**
   * Runs strictly on `localhost` (Node.js + Express backend, SQLite database, React + Vite frontend).
   * No cloud relays, no Cloud Functions, no external proxies, no third-party telemetry.
4. **Safety & Non-Destructive Operation:**
   * Never delete source files automatically.
   * Rebalancing/deletion is an optional, separate, explicit user action requiring secondary confirmation.

---

## 3. Unified System Architecture

```text
+-------------------------------------------------------------------------------+
|                             React + Vite Frontend                             |
|  [Account Manager]   [Drive Migration UI]   [Photos Migration UI]   [History] |
+---------------------------------------+---------------------------------------+
                                        | (REST / WebSocket / SSE)
+---------------------------------------v---------------------------------------+
|                            Node.js Express Server                             |
|                                                                               |
|  +---------------------+  +----------------------+  +----------------------+  |
|  |    OAuth Engine     |  |    Drive Service     |  |    Photos Service    |  |
|  |  (Tokens / Refresh) |  | (Tree & files.copy)  |  |  (Relay & Batch)     |  |
|  +----------+----------+  +----------+-----------+  +----------+-----------+  |
|             |                        |                         |              |
|  +----------v------------------------v-------------------------v-----------+  |
|  |                     Job & Task Execution Engine                         |  |
|  |          (State machine, Concurrency limiter, Retry & Resumption)       |  |
|  +-----------------------------------+-------------------------------------+  |
|                                      |                                        |
|  +-----------------------------------v-------------------------------------+  |
|  |                      SQLite Storage & Audit Layer                       |  |
|  |        (Accounts, Migration Plans, Jobs, Items, Transfer Logs)          |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 4. Database Schema (SQLite)

```sql
-- Connected Accounts
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,               -- 'source' or 'destination'
    email TEXT NOT NULL,
    account_type TEXT NOT NULL,        -- 'A' or 'B'
    token_data TEXT NOT NULL,          -- encrypted/local JSON token payload
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration Jobs
CREATE TABLE migration_jobs (
    id TEXT PRIMARY KEY,
    service_type TEXT NOT NULL,        -- 'DRIVE' or 'PHOTOS'
    source_account_id TEXT NOT NULL,
    dest_account_id TEXT NOT NULL,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status TEXT NOT NULL,              -- 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Item-Level Migration Manifest
CREATE TABLE migration_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    source_item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    item_type TEXT NOT NULL,           -- 'FILE', 'FOLDER', 'PHOTO', 'VIDEO'
    parent_path TEXT,                  -- relative folder hierarchy for Drive
    dest_parent_id TEXT,               -- mapped destination parent ID
    dest_item_id TEXT,                 -- created item ID in Account B
    status TEXT NOT NULL,              -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    FOREIGN KEY (job_id) REFERENCES migration_jobs(id)
);

-- Audit & Activity Logs
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    level TEXT NOT NULL,               -- 'INFO', 'WARN', 'ERROR'
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Modular Service Specifications

### 5.1 Google Drive Service (`DriveMigrationEngine`)
* **Discovery & Mapping:** Reads selected tree structure from Picker, builds adjacency list, and computes execution ordering (parents first).
* **Destination Skeleton Creation:** Recreates directory tree in Account B using `parents: [destParentId]`.
* **Execution:** Calls `permissions.create` (Share to B) &rarr; Account B `files.copy` (Server-to-Server Copy) with `parents: [targetFolderId]`.
* **Zero Data Footprint:** 0 bytes transferred locally.

### 5.2 Google Photos Service (`PhotosMigrationEngine`)
* **Session Lifecycle:** Creates session (`POST /v1/sessions`), tracks picking via polling.
* **Metadata Normalization:** Extracts `baseUrl`, `filename`, `mediaMetadata` (camera params, creation time).
* **In-Memory Streaming Pipeline:**
  * Worker thread / stream pump fetches chunks from `${baseUrl}=d` (Account A) directly into a memory stream.
  * Streams to `photoslibrary.googleapis.com/v1/uploads` (Account B) with `X-Goog-Upload-Protocol: raw`.
  * Calls `mediaItems:batchCreate` with `uploadToken` and original filename.
  * Explicitly de-allocates buffer.

### 5.3 Resilient Job Engine
* Concurrency limiter (2-4 concurrent Drive copies / Photos uploads to avoid Google rate limits).
* Exponential backoff on HTTP 429/503.
* Persistent SQLite job state enables instant pause, resume, and partial retry on failure.

---

## 6. Implementation Phasing for Production MVP

```text
Phase 1: Database & Backend Foundation
  ├── SQLite migrations and connection manager
  ├── OAuth credential & session repository
  └── API route structure

Phase 2: Core Migration Engines
  ├── DriveEngine (Tree builder, Share & Copy pipeline)
  ├── PhotosEngine (Session manager, In-memory stream pump)
  └── JobExecutor (Queue, concurrency control, error handling)

Phase 3: React + Vite Unified Frontend
  ├── Design system & layout (Modern dark aesthetic)
  ├── Account Connection Dashboard
  ├── Drive Migration Wizard (Picker -> Tree Preview -> Execute)
  ├── Photos Migration Wizard (Picker -> Descriptors -> Stream & Upload)
  └── Live Job Monitor & Transfer Audit Log

Phase 4: End-to-End Verification & Hardening
  ├── Automated unit/integration tests for job state machine
  ├── Live multi-file Drive hierarchy test
  ├── Live multi-photo streaming test
  └── Safety confirmation dialogs for optional source cleanup
```
