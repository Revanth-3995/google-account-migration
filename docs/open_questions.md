# Open Questions and Research Requirements

**Project:** Google Account Migration Tool  
**Version:** 0.2 — Corrected Planning Draft  
**Date:** 2026-08-17  
**Status:** Pre-implementation. No research has been conducted against live APIs or official documentation.

---

> [!CAUTION]
> Every item in this document is an **assumption that must NOT be treated as a
> fact until explicitly researched and confirmed against current official Google
> documentation**. This includes questions where a previous answer seemed obvious.
> Google's APIs, policies, and scope classifications change over time.

> [!NOTE]
> **Prompt 2 research is complete.** See [`docs/research_findings.md`](research_findings.md)
> for full findings, source citations, and architecture implications for each question.
> The summary table below has been updated to reflect answered questions.

> [!NOTE]
> This document is the authoritative source of what is **unknown**. The
> `product_requirements.md` and `privacy_and_security_rules.md` documents define
> what is **required**. There is no conflict: requirements state what the product
> must do; this document states what must be researched before we know how.

---

## How to Use This Document

Each question is tagged:

- 🔴 **Blocker** — implementation cannot proceed for the related feature until this is answered
- 🟡 **Partial** — implementation can proceed cautiously but the answer affects scope or UX
- 🔵 **Design Decision** — not a research question but a choice to be made by the team

Each question also has a **source** indicating where it originated:

- `[ID11]` — directly from `Initial_document.md` Section 11 (the project's authoritative open questions list)
- `[ID8]` — from `Initial_document.md` Section 8 (research checklist)
- `[Review]` — identified during the documentation review pass

---

## Category A — Google Drive: Ownership Transfer

---

### OQ-D-OT-01 — Can Drive file ownership be transferred between two personal consumer Gmail accounts? 🔴

**Source:** `[ID11]` Question 1

**Assumption being tested:** Ownership transfer is possible (or impossible) between
two `@gmail.com` personal consumer accounts.

> ⚠️ A previous document draft stated "ownership transfer is only possible within the
> same Google Workspace domain, not applicable for personal accounts." This was an
> unresearched assumption and has been corrected. The actual behavior must be verified.

**Questions to answer:**
- Does the Google Drive API's `permissions.create` with `role: owner` work when the
  target email is a personal `@gmail.com` account and the source is also `@gmail.com`?
- Does the recipient need to explicitly accept ownership? What does that flow look like?
- Which file types support ownership transfer (binary files, Google Docs, Sheets, Slides, Folders)?
- What file types explicitly cannot have ownership transferred?
- What happens to quota on both accounts after ownership transfer?
- What happens to comments, revision history, sharing settings, and public URLs after transfer?
- Are there any rate limits or per-day limits on ownership transfer operations?

**Why it matters:** If ownership transfer works for personal accounts, it is a
potentially metadata-only migration path (no byte streaming required), which is
significantly simpler and safer architecturally.

---

### OQ-D-OT-02 — Are there Drive file types that block ownership transfer? 🟡

**Source:** `[ID11]` Question 2 / `[ID8]`

**Questions to answer:**
- Can binary files (PDFs, images, videos) be ownership-transferred?
- Can Google-native files (Docs, Sheets, Slides, Forms, Drawings) be ownership-transferred?
- Can folders be ownership-transferred (and does this recursively transfer their contents)?
- What happens to files owned by third parties (files shared with Account A but owned by others)?

---

### OQ-D-OT-03 — Can folders be transferred recursively? 🟡

**Source:** `[ID11]` Question 3 / `[ID8]`

**Questions to answer:**
- If ownership of a folder is transferred, do all files inside also transfer?
- Or must each file be transferred individually?
- Does recursive transfer require an API call per item, or one API call for the folder?
- How are nested sub-folders handled?
- Does recursive transfer count against rate limits?

---

## Category B — Google Drive: Server-Side Copy (`files.copy`)

---

### OQ-D-01 — Can `files.copy` copy a file from Account A to Account B? 🔴

**Source:** `[ID8]` / `[Review]`

**Assumption being tested:** The Drive API `files.copy` endpoint can copy a file
between two different personal accounts, without bytes traveling through our infrastructure.

**Questions to answer:**
- Does `files.copy` work when the caller is authenticated as Account A but the
  destination is Account B?
- Or does `files.copy` only create a copy within the same account?
- If cross-account direct copy is not supported, what is the actual flow? Must
  Account A share the file with Account B, then Account B calls `files.copy`?
- Does the destination account need prior permission on the file before `files.copy` can be called?
- Which file types are supported by `files.copy` (binary, Google-native)?
- What metadata is preserved vs. lost in a copy (revision history, comments, sharing settings)?
- What quota behavior results from a copy operation on each account?
- Are there file size limits for `files.copy`?
- What rate limits or daily quotas apply?

**Why it matters:** If server-side copy works between accounts, it may avoid bytes
traveling through our infrastructure, which is a significant privacy and infrastructure benefit.

---

### OQ-D-04 — What metadata is lost when exporting and re-importing Google-native files? 🟡

**Source:** `[ID8]` / `[Review]`

**Questions to answer:**
- When exporting a Google Doc as `.docx` and re-importing to create a new Google Doc,
  what exactly is lost? (e.g., comments, named ranges, revision history, collaborator list)
- Is formatting fidelity acceptable for common document types?
- What export formats are available for each native type (Doc, Sheet, Slide, Form, Drawing)?
- Which re-import formats result in an editable Google-native file vs. a static copy?
- Is there an API parameter to trigger automatic format conversion on upload?
- Can `files.copy` be used for native files cross-account as an alternative to export/import?

**Why it matters:** Users must be accurately informed about what they will lose.
We must not promise lossless migration if it is lossy.

---

### OQ-D-05 — How are folders handled in migration? 🟡

**Source:** `[ID8]` / `[Review]`

**Questions to answer:**
- Does creating a folder in Account B via the Drive API require any special permissions?
- Can a folder be "migrated" without listing all its contents (to avoid Rule DA-1 violation)?
- If the user selects a folder for migration, what exactly must the tool do to
  recreate the folder structure in Account B?
- Does "selecting a folder" imply consent to list its immediate children only, or
  all descendants recursively?
- Must the user be shown a preview of what is inside a folder before migration begins?

**Privacy implication:** Folder traversal must be explicitly authorized by the user.
The exact authorization model must be designed after this is researched.

---

### OQ-D-02 — What is the minimum OAuth scope required for Drive operations? 🔴

**Source:** `[ID8]` / `[Review]`

**Assumption being tested:** A scope narrower than the full `drive` scope is
sufficient to power a file-browsing selection UI and to perform migration.

**Questions to answer:**
- Does `drive.metadata.readonly` allow listing files in a folder for a user selection UI?
  Or is `drive.readonly` required?
- What is the exact difference between `drive.readonly`, `drive.metadata.readonly`,
  and `drive.file` in terms of what each scope can access?
- Does `drive.file` (which covers only files created or opened by our app) apply to
  the source account's existing files at all?
- What scope is required to download binary file bytes (not just metadata)?
- What scope is required to upload a file to Account B?
- Which scopes are classified as "sensitive" vs. "restricted" by Google?
- Does any required scope trigger a mandatory formal security assessment?

> ⚠️ All specific scope names mentioned in other documents (e.g., `drive.readonly`,
> `drive.file`) are **illustrative placeholders only** until this question is answered.

---

### OQ-D-06 — What does the Google OAuth app verification process require? 🔴

**Source:** `[Review]`

**Questions to answer:**
- Which tier (Basic, Sensitive, Restricted) do the Drive and Photos scopes required
  for our use case fall under?
- What does verification require for each tier (privacy policy, security assessment, etc.)?
- Is there a "test users" mode that allows development and limited real-account
  testing without completing verification?
- How many test accounts are permitted without verification?
- Is there a time limit on unverified operation?
- What is the typical timeline for completing verification?

**Why it matters:** If required scopes are in the Restricted tier, a formal security
assessment is required before production. This has significant timeline implications
and must be understood before development starts.

---

### OQ-D-07 — What are Drive API quotas for personal projects? 🟡

**Source:** `[ID11]` Question 13 / `[ID8]`

**Questions to answer:**
- What is the per-project Drive API quota (queries per day, queries per 100 seconds)?
- What is the per-user quota per 100 seconds?
- Are there separate quotas for read vs. write operations?
- Does downloading file bytes count toward quota?
- Does the quota reset daily? At what time?
- Can quota be increased for legitimate personal use cases, and how?
- What happens when quota is exceeded — hard error or soft degradation?

---

### OQ-D-08 — How are large files handled in Drive? 🟡

**Source:** `[ID11]` Question 14 / `[ID8]`

**Questions to answer:**
- What is the maximum file size for a binary file in a personal Google Drive?
- Does the Drive API support resumable downloads? Which endpoint/parameter?
- Does the Drive API support resumable uploads? What is the resumable upload protocol?
- If a large transfer fails halfway, can it be resumed without restarting from byte 0?
- What happens to partially uploaded files in the destination account?

---

## Category C — Google Photos: Picker and Selection

---

### OQ-P-01 — Does a Google Photos Picker API exist for web applications? 🔴

**Source:** `[ID8]` / `[Review]` / `[Initial_document.md]` Section 4C

**Assumption being tested:** An officially supported, user-selection mechanism exists
for Google Photos that allows the user to explicitly select specific photos/videos,
with our application receiving only references to selected items (not a full library listing).

> ⚠️ Google announced a "Photos Picker API" for Android in 2023. Whether an equivalent
> mechanism exists for web (browser-based) applications is **unverified**. Do not
> assume the Android picker applies to web.

**Questions to answer:**
- Does a Google Photos Picker API exist for web applications (not Android)?
- If yes, what scopes does it require?
- Does it provide item-level access only to selected photos/videos, or does it
  also grant access to the broader library?
- How long are the media URLs/access tokens returned by the picker valid?
- Can selection be made from specific albums, or only from the full library view?
- Is there a limit on how many items can be selected in one picker session?
- Can the picker return video files as well as photos?

**Why it matters:** If no picker exists for web, the only Photos access path requires
listing the user's entire library, which may violate Rule DA-1. In that case, Photos
may need to be removed from initial scope or redesigned around a different mechanism
(e.g., guided Takeout workflow).

---

### OQ-P-02 — What OAuth scopes does Google Photos require? 🔴

**Source:** `[ID8]` / `[Review]`

**Questions to answer:**
- What exact scopes are required for each Photos operation (picker session, library
  read, album read, media upload)?
- What is the difference between `photoslibrary.readonly` and any picker-specific scope?
- Which scopes are classified as Sensitive or Restricted by Google?
- Does any Photos scope require formal security assessment before production use?
- What scope is required to upload media to Account B's Photos library?

---

### OQ-P-03 — Can media bytes be copied from Account A's Photos to Account B's Photos via the Library API? 🔴

**Source:** `[ID8]`

**Questions to answer:**
- Does the Photos Library API v1 support downloading full-resolution media bytes?
- Does the Photos Library API v1 upload endpoint accept externally downloaded media?
- Are there file size limits for uploads via the Library API?
- What are the rate limits for Photos API operations?
- Does uploading via API count against the destination account's Google Storage quota?

---

### OQ-P-04 — Is EXIF, timestamp, and GPS metadata preserved after upload? 🔴

**Source:** `[ID11]` Questions 8 and 9 / `[ID8]`

**Questions to answer:**
- When a photo is uploaded to Google Photos via the Library API, does the original
  capture timestamp (from EXIF data) appear as the photo's date in the destination library?
- Or does the upload timestamp replace the original capture timestamp?
- Is GPS/location data in EXIF preserved through download and re-upload?
- Are there API parameters to explicitly set the creation time on upload?
- Does the behavior differ between JPEG, PNG, HEIC, and RAW formats?

**Why it matters:** A migration that changes the apparent date of all photos is
disruptive for users whose libraries are organized chronologically.

---

### OQ-P-05 — How are video files handled in Google Photos migration? 🟡

**Source:** `[ID11]` Question 10 / `[ID8]`

**Questions to answer:**
- Can videos be downloaded and re-uploaded via the Photos Library API?
- Are there format restrictions on which video types can be uploaded?
- Is there a file size limit for video uploads?
- How long do video download URLs remain valid (important for large files that take time to transfer)?
- Does the same picker mechanism that applies to photos also apply to videos?

---

### OQ-P-06 — How should media transfer failure and interruption be handled? 🟡

**Source:** `[ID11]` Questions 7 and 11 / `[ID8]`

**Questions to answer:**
- If a photo/video upload is interrupted partway, is there a resumable upload mechanism
  in the Photos Library API?
- Can a partially uploaded media item cause a corrupt entry in the destination library?
- How can duplicate uploads be detected and prevented? (e.g., if the user retries
  a failed migration)
- What does the Photos API return when a duplicate is uploaded — error, silent ignore, or duplicate entry?

---

### OQ-P-07 — Does Google Photos Terms of Service permit third-party migration tools? 🔴

**Source:** `[Review]`

**This is a legal/policy question as much as a technical one.**

**Questions to answer:**
- Does the current Google Photos Terms of Service prohibit using the Library API to
  read media from one account for the purpose of uploading to a different account?
- Does the Google API Services User Data Policy permit this use case?
- Is there a distinction in ToS between "backup/restore to the same account" vs.
  "cross-account migration"?
- What constitutes a prohibited use of the Photos Library API?

**Status:** Unverified. Treat as a potential legal blocker until confirmed with
current official documentation.

---

### OQ-P-08 — What is the behavior of Google Photos Partner Sharing? 🟡

**Source:** `[Initial_document.md]` Section 4A

**Questions to answer:**
- What exactly does Partner Sharing allow one account to share with another?
- Does the receiving account's "Save" action create a copy that counts against their quota?
- Is Partner Sharing automatable via an API, or is it exclusively a Google-native UI flow?
- If it is not automatable, what is the correct role for our tool — could we provide
  a guided workflow that directs users through the Google-native UI?
- Does Partner Sharing have limits on how many photos can be shared?

---

## Category D — ToS and Policies

---

### OQ-L-01 — Does Google's Terms of Service permit cross-account migration via Drive API? 🔴

**Source:** `[Review]`

**Questions to answer:**
- Does the Google Drive API Terms of Service prohibit using the API to copy files
  from one personal account to another personal account, where both accounts are
  controlled by the same individual?
- Does the Google API Services User Data Policy restrict this use case?
- Are there any restrictions in the Google Drive ToS on applications that access
  files beyond those the application itself created?

---

## Category E — Infrastructure and Architecture

---

### OQ-I-01 — What is the server language and framework? 🔵

**Source:** `[Review]`

**This is a design decision, not a research question.**

The choice should account for: streaming support, OAuth library availability,
memory management for large file streaming, and async I/O for concurrent transfers.
Decision should be made after architecture-blockers (OQ-D-01 through OQ-D-OT-01)
are resolved, since the migration model affects infrastructure requirements.

**Status:** Design decision pending. Not a blocker for documentation phase.

---

### OQ-I-02 — What is the hosting model? 🔴

**Source:** `[Review]`

**Questions to answer:**
- Is the application hosted as a web service on a server controlled by the developer?
- Or is it a local-only desktop tool (CLI or Electron app)?
- The hosting model affects: OAuth redirect URI configuration, HTTPS requirements,
  credential security model, and infrastructure cost for streaming.

**Why it matters:** Google OAuth requires a registered, accessible redirect URI.
This must be confirmed before OAuth client credentials can be created.

---

### OQ-I-03 — Can large files be streamed through our server without timeout? 🟡

**Source:** `[ID11]` Question 14 / `[ID8]`

**Questions to answer:**
- What is the maximum file size for a single personal Drive item (binary file)?
- What are typical transfer speeds between Google Drive download and upload endpoints?
- What HTTP timeout limits apply to the server framework under consideration?
- Can the Drive upload API use chunked/resumable upload to handle timeouts gracefully?
- If a streaming transfer times out mid-way, what is the state of the destination file?

---

### OQ-I-04 — What are the practical rate limits for a bulk personal migration? 🟡

**Source:** `[ID11]` Question 13 / `[ID8]`

**Questions to answer:**
- For a migration of approximately 1,000 files totaling approximately 50 GB, how long
  would the operation take under typical Drive API quotas?
- Would this require spreading the migration across multiple days?
- Does the Drive API support batch operations that reduce quota usage?
- Does the Photos API support batch operations?
- What is the retry strategy for 429 (Too Many Requests) responses?

---

### OQ-I-05 — What infrastructure costs arise from streaming bytes through our server? 🟡

**Source:** `[ID11]` Question 14

**Questions to answer:**
- What is the egress/ingress cost for streaming large files through a cloud server?
- Is a server-side copy model (OQ-D-01) feasible to avoid byte streaming costs?
- If bytes must travel through our server, what is the estimated cost per GB transferred?
- What are the bandwidth limits of typical cloud servers (VPS, container)?

---

## Summary Table

| ID | Category | Topic | Priority | Source |
|---|---|---|---|---|
| OQ-D-OT-01 | Drive: Ownership | Cross-account ownership transfer feasibility | ✅ Answered | ID11 Q1 |
| OQ-D-OT-02 | Drive: Ownership | File types blocked from ownership transfer | 🟡 Partial | ID11 Q2 |
| OQ-D-OT-03 | Drive: Ownership | Recursive folder transfer | ✅ Answered — NOT recursive | ID11 Q3 |
| OQ-D-01 | Drive: files.copy | Cross-account server-side copy | ✅ Answered — share+copy workflow | ID8 |
| OQ-D-04 | Drive: Native files | Export/import metadata loss extent | 🟡 Partial — POC needed | ID8 |
| OQ-D-05 | Drive: Folders | Folder traversal model | 🟡 Partial — Drive Picker handles | ID8 |
| OQ-D-02 | Drive: Scopes | Minimum scope for listing and transfer | ✅ Answered — drive.file + Picker | ID8 |
| OQ-D-06 | Drive: OAuth | App verification tier and process | ✅ Answered — drive.readonly is Restricted | Review |
| OQ-D-07 | Drive: Quotas | API quota limits for personal projects | 🟡 Partial — 750GB/day confirmed | ID11 Q13 |
| OQ-D-08 | Drive: Large files | Resumable download/upload support | ✅ Answered | ID11 Q14 |
| OQ-P-01 | Photos: Picker | Web picker API existence | ✅ Answered — EXISTS | ID8 |
| OQ-P-02 | Photos: Scopes | Minimum scopes for Photos operations | 🟡 Partial — tier unverified | ID8 |
| OQ-P-03 | Photos: Copy | Media download and upload feasibility | ✅ Answered — 200MB/20GB limits | ID8 |
| OQ-P-04 | Photos: Metadata | EXIF/timestamp/GPS preservation | 🟡 Partial — EXIF-based; no API override | ID11 Q8-9 |
| OQ-P-05 | Photos: Video | Video transfer handling | 🟡 Partial — processing delay noted | ID11 Q10 |
| OQ-P-06 | Photos: Failures | Resumability and duplicate prevention | ⚠️ Open | ID11 Q7, 11 |
| OQ-P-07 | Photos: ToS | Legal permission for migration use case | ✅ Answered — permitted with conditions | Review |
| OQ-P-08 | Photos: Partner | Partner Sharing behavior and automability | ⚠️ Open — likely UI-only | ID section 4A |
| OQ-L-01 | Legal: Drive | Drive ToS permission for cross-account migration | ✅ Answered — permitted | Review |
| OQ-I-01 | Infra | Server language and framework | 🔵 Decision | Review |
| OQ-I-02 | Infra | Hosting model | 🔵 Decision | Review |
| OQ-I-03 | Infra | Large file streaming and timeouts | ⚠️ Open | ID11 Q14 |
| OQ-I-04 | Infra | Practical rate limits for bulk migration | ⚠️ Open | ID11 Q13 |
| OQ-I-05 | Infra | Infrastructure cost of byte streaming | ⚠️ Open | ID11 Q14 |

---

## Recommended Research Order

Address blockers before design. Address design before architecture. Architecture before implementation.

### Phase R-1 — Legal and Policy Gates (resolve before any technical design)

1. **OQ-L-01** — Drive ToS cross-account migration permission
2. **OQ-P-07** — Photos ToS permission for migration use case
3. **OQ-D-06** — OAuth verification tier (Sensitive vs. Restricted scopes)

### Phase R-2 — Core Architecture Gates (determines what is buildable)

4. **OQ-D-OT-01** — Ownership transfer between personal accounts
5. **OQ-D-01** — `files.copy` cross-account server-side copy behavior
6. **OQ-P-01** — Photos Picker web API existence (determines if Photos stays in scope)
7. **OQ-I-02** — Hosting model (required to configure OAuth redirect URI)

### Phase R-3 — OAuth and Permission Design

8. **OQ-D-02** — Minimum Drive scopes
9. **OQ-P-02** — Minimum Photos scopes

### Phase R-4 — Data Quality and UX Design

10. **OQ-D-04** — Metadata loss in native file export/import
11. **OQ-P-04** — EXIF/timestamp preservation
12. **OQ-D-OT-02 + OQ-D-OT-03** — Ownership transfer file type and folder constraints
13. **OQ-P-08** — Partner Sharing automability

### Phase R-5 — Infrastructure Planning

14. **OQ-D-07 + OQ-D-08** — Drive quotas and large file handling
15. **OQ-P-03 + OQ-P-05 + OQ-P-06** — Photos upload, video, resumability
16. **OQ-I-03 + OQ-I-04 + OQ-I-05** — Streaming constraints and costs

### Phase R-6 — Implementation Design Decisions

17. **OQ-I-01** — Server language and framework (after architecture is confirmed)

---

## Questions from `Initial_document.md` Section 11 — Coverage Tracking

The following 15 questions were listed in the project's authoritative source document
(`Initial_document.md` Section 11). Each is mapped to its corresponding open question above.

| # | Original Question | Maps To | Status |
|---|---|---|---|
| 1 | Can ownership of all relevant Drive files be transferred between two personal Gmail accounts? | OQ-D-OT-01 | ✅ Answered — supported, file-by-file, requires acceptance |
| 2 | What Drive file types cannot be ownership-transferred? | OQ-D-OT-02 | ⚠️ Partial — POC needed |
| 3 | Can folders be transferred recursively? | OQ-D-OT-03 | ✅ Answered — NOT recursive; file-by-file only |
| 4 | Is server-side Drive copy suitable for large binary files? | OQ-D-01 + OQ-D-08 | ✅ Answered — yes, via share+files.copy; 5TB max |
| 5 | What exactly happens to quota after each migration method? | OQ-D-OT-01 + OQ-D-01 | 🟡 Partial — copy counts against destination quota |
| 6 | Can Photos Picker media bytes be streamed reliably? | OQ-P-01 + OQ-P-03 | ✅ Answered — Picker exists; baseUrl gives access to bytes |
| 7 | Can Picker media transfers be resumed? | OQ-P-06 | ⚠️ Open — Library API resumable upload TBD |
| 8 | Are original EXIF timestamps preserved after destination upload? | OQ-P-04 | 🟡 Answered — yes via EXIF; no API override |
| 9 | Is GPS metadata preserved? | OQ-P-04 | 🟡 Yes if EXIF intact; pass-through must not strip it |
| 10 | How should videos be verified? | OQ-P-05 | 🟡 Partial — videoProcessingStatus delay noted |
| 11 | What happens when a transfer partially succeeds? | OQ-P-06 + OQ-I-03 | ⚠️ Open |
| 12 | How can duplicate uploads be prevented? | OQ-P-06 | ⚠️ Open |
| 13 | What are the practical rate limits for bulk operations? | OQ-D-07 + OQ-I-04 | 🟡 Partial — 750 GB/day Drive; request rate TBD |
| 14 | What infrastructure costs arise if the application streams bytes? | OQ-I-05 | ⚠️ Open — estimation needed |
| 15 | Can a useful product be built while keeping the user in control and minimizing access? | All of the above | 🟢 YES — Picker APIs (Drive + Photos) make this viable |

---

*Document status: Planning draft. No API research has been conducted. No Google
account, Google API, file content, email, or storage was accessed or modified
in the creation of this document.*
