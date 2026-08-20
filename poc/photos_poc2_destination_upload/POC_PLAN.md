# PHOTOS-POC-2: Source A In-Memory Relay -> Destination Account B Upload Feasibility

**Project:** Google Account Migration Tool  
**Experiment:** PHOTOS-POC-2  
**Purpose:** Verify that a photo selected in Account A can be streamed through in-memory ephemeral relay to Account B under `photoslibrary.appendonly` with intact metadata and zero disk persistence.

---

## 1. Test Architecture
```
Account A (Source)
  |
  +-> Google Photos Picker UI (photospicker.mediaitems.readonly)
  |     |
  |     v
  |   baseUrl (High-res media link)
  |
  v
In-Memory Relay (Node.js RAM Buffer)
  | [0 Disk Storage / Ephemeral ArrayBuffer]
  v
Account B (Destination)
  |
  +-> POST /v1/uploads (photoslibrary.appendonly) -> uploadToken
  |
  +-> POST /v1/mediaItems:batchCreate -> Destination Media Item Created!
```

---

## 2. Test Steps
1. **Connect Account A** with `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
2. **Connect Account B** with `https://www.googleapis.com/auth/photoslibrary.appendonly`.
3. **Create Picker Session & Select Photo** in Account A.
4. **Poll & Retrieve Metadata Descriptors** for selected photo.
5. **Execute In-Memory Relay -> Destination Upload:**
   - Download bytes into RAM buffer.
   - Audit EXIF markers in RAM.
   - Stream upload bytes to Account B's `/v1/uploads` endpoint.
   - Receive `uploadToken` and call `/v1/mediaItems:batchCreate`.
   - Release RAM buffer.
6. **Verify Destination Results** in Account B's Google Photos library.
7. **Clean up session.**
