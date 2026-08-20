# Product Requirements Document

**Project:** Google Account Migration Tool  
**Version:** 0.1 — Planning Draft  
**Date:** 2026-08-17  
**Status:** Pre-implementation. No code exists. No APIs have been accessed.

---

## 1. Problem Statement

### 1.A What Exact Problem Are We Solving?

Google does not offer a first-party data migration tool for individuals who want
to selectively move specific data from one personal Google account to a different
personal Google account.

Existing workarounds:
- **Google Takeout** exports data as archives, but importing those archives into
  a destination account requires manual, service-by-service effort and is not
  universally supported.
- **Third-party migration services** exist but typically require broad, all-or-nothing
  OAuth permissions, provide no transparency about what data they access, and are
  unsuitable for users who value privacy.
- **Manual copy-paste** (e.g., downloading Drive files and re-uploading) is tedious
  and error-prone for large or structured data.

**The gap we fill:** A lightweight, transparent, user-controlled tool that lets a
person pick specific files or media from Account A and move/copy them to Account B,
with full visibility into what the tool is doing and why it needs each permission.

---

## 2. Target User

### 1.B Who Is the Target User?

**Primary persona:** An individual (non-enterprise) Google account holder who:

- Has two personal Google accounts and wants to consolidate or selectively migrate
  data between them.
- Is privacy-conscious and unwilling to grant blanket permissions to unknown tools.
- Does not have a technical background (cannot write scripts or use APIs directly).
- Has a valid, specific reason for migrating: e.g., leaving a university/employer
  Google account, combining two old personal accounts, preparing a fresh account.

**Secondary persona:** A technically literate user who wants a transparent,
auditable migration process they can understand and verify.

**Explicitly NOT our target user:**
- Organizations migrating Workspace domains.
- Users wanting to migrate Gmail.
- Developers who can write their own migration scripts.

---

## 3. Services In Scope and Out of Scope

### 1.G Which Services Are In Scope and Out of Scope?

#### In Scope — Initial Version

| Service | Scope Level | Constraint |
|---|---|---|
| **Google Drive — binary files** | In scope | User-selected items only; PDFs, images, videos, ZIP files, etc. |
| **Google Drive — Google-native files** | In scope (research required) | Docs, Sheets, Slides — mechanism differs from binary files |
| **Google Drive — folders** | Conditionally in scope | Only if technically feasible without silently scanning contents |
| **Google Photos** | Conditionally in scope (research required) | Only if an officially supported, privacy-compatible selection mechanism exists |

#### Explicitly Out of Scope — Initial Version

| Service | Reason |
|---|---|
| **Gmail** | Privacy risk; no legitimate minimal-scope path; user emails are highly sensitive |
| **Google Contacts** | Out of scope for MVP; separate research required for future version |
| **Google Calendar** | Out of scope for MVP |
| **Google Keep** | Out of scope for MVP |
| **Google Maps / Saved Places** | Out of scope for MVP |
| **YouTube** | Out of scope for MVP |
| **Google Workspace Shared Drives** | Organizational data; ownership rules differ; outside persona |
| **Google Workspace Admin features** | Enterprise territory; not applicable to personal accounts |

---

## 4. What "Migration" Means Per Service

### 1.C What Does "Move" Mean for Drive Versus Photos?

#### 4.1 Google Drive — Binary Files (PDFs, images, videos, ZIPs, etc.)

| Operation | Description | Privacy Classification |
|---|---|---|
| **Server-side copy (preferred if available)** | Google copies the file between accounts without bytes passing through our infrastructure | Metadata access only on our side |
| **Stream-through copy** | We download bytes from Account A, upload bytes to Account B | Full content access — must be explicit user consent |
| **Export/Import** | Download in native format, re-upload | Full content access — must be explicit user consent |

> **"Move" in Drive means:** A copy is created in the destination account. The
> source file is NOT deleted. If the user wishes to delete the source after
> confirming the copy succeeded, that is a separate, manually-confirmed action.
> The initial MVP will NOT include source deletion.

#### 4.2 Google Drive — Google-Native Files (Docs, Sheets, Slides)

| Operation | Description | Notes |
|---|---|---|
| **Export + re-import** | Export as Office format (docx, xlsx, pptx), upload to destination as Google Doc | Lossy; formatting may differ — **unverified extent of loss** |
| **Export + re-import as native** | Export as PDF or other format, re-upload | Not editable as Google Doc |
| **Ownership transfer** | May or may not be supported between personal consumer Gmail accounts | ⚠️ **Must be verified** — see OQ-D-OT-01 |
| **Copy via Drive API (`files.copy`)** | API exists but cross-account behavior is unverified | ⚠️ **Must be verified** — see OQ-D-01 |

> ⚠️ **Research required:** The ownership transfer path and `files.copy` cross-account
> behavior are both **unverified assumptions**. Do not treat either as available or
> unavailable until researched against current official documentation.
> See `docs/open_questions.md` questions OQ-D-OT-01 and OQ-D-01.

#### 4.3 Google Photos

| Operation | Description | Notes |
|---|---|---|
| **Google Picker (user-selection UI)** | User uses Google's own photo picker; we receive only selected item references | Preferred — minimal permission footprint |
| **Photos Library API** | We programmatically list and access photos | Requires broader scope; must evaluate privacy implications |
| **Export + re-upload** | Download media bytes, re-upload to destination Photos | Full content access; must be explicit |

> **"Move" in Photos means:** A copy of the media is created in the destination
> account's library. Source media is NOT deleted. The initial MVP will NOT include
> source deletion.
>
> ⚠️ **Research required:** Does Google Photos have a Picker API that satisfies
> the privacy requirement? See `docs/open_questions.md`.

---

## 5. Explicit User Actions Required

### 1.D Which User Actions Must Always Be Explicit?

The following actions must NEVER happen automatically. Each requires a distinct,
deliberate user interaction:

| Action | Required User Interaction |
|---|---|
| **Connecting Account A (source)** | User initiates OAuth flow; user sees permission screen |
| **Connecting Account B (destination)** | Separate OAuth flow; user sees permission screen |
| **Selecting files/folders to migrate** | User selects each item or batch; no auto-selection |
| **Reviewing the migration list** | User reviews a summary of what will be migrated before action |
| **Confirming migration start** | User clicks an explicit "Start migration" confirmation |
| **Initiating any deletion** | Separate screen, separate confirmation — NOT available in MVP |
| **Revoking application access** | User must be informed how to revoke; tool provides instructions |
| **Disconnecting an account** | User must explicitly disconnect; tool clears session on disconnect |

---

## 6. What Data Is Forbidden from Automatic Access

### 1.E What Data Is Forbidden from Automatic Access?

"Automatic" means: accessed without the user selecting that specific item or
category in this session.

| Data Category | Status | Reason |
|---|---|---|
| **Email messages** | 🚫 Forbidden — permanently | Out of scope; high sensitivity |
| **Email attachments** | 🚫 Forbidden — permanently | Out of scope |
| **Entire Drive file list** | 🚫 Forbidden — automatically | May only be fetched to power user selection UI; not silently stored |
| **File contents of unselected files** | 🚫 Forbidden | Only selected files may have bytes read |
| **Entire Photos library listing** | 🚫 Forbidden — automatically | May only be fetched to power user selection UI; not silently stored |
| **Photo/video bytes of unselected items** | 🚫 Forbidden | Only user-selected media may have bytes downloaded |
| **Contact lists** | 🚫 Forbidden — permanently (MVP) | Out of scope |
| **Calendar data** | 🚫 Forbidden — permanently (MVP) | Out of scope |
| **Search history** | 🚫 Forbidden — permanently | Never in scope |
| **Location history** | 🚫 Forbidden — permanently | Never in scope |

---

## 7. Metadata vs. Content Access

### 1.F What Is the Difference Between Metadata Access and Content/Byte Access?

This distinction is **critical** to the privacy model.

#### Metadata Access (may be permitted with justification)

Metadata is information *about* a file or item, not the file itself.

Examples of metadata for a Drive file:
- File name
- File size
- MIME type
- Creation date / modification date
- Owner (email address)
- Sharing settings (who has access)
- Folder path / parent folder ID
- File ID (Google's internal identifier)
- Thumbnail URL (if provided by API without downloading content)

**Metadata access is permitted** only when:
1. The user has connected their account.
2. The purpose is to display a selection UI to the user.
3. Metadata is not stored persistently on our servers beyond the active session.
4. The scope required to access that metadata is the minimum required scope.

#### Content / Byte Access (strictly controlled)

Content access means reading the actual bytes of a file — the text in a Doc, the
pixels of a photo, the data in a PDF.

**Content/byte access is permitted ONLY when:**
1. The user has explicitly selected that specific item for migration.
2. The user has reviewed and confirmed the migration list.
3. The user has clicked an explicit start action.
4. The bytes are used only to transfer to the destination account.
5. The bytes are not logged, stored, or inspected on our servers.

**Content/byte access is NEVER permitted for:**
- Files the user has not selected.
- Running automated analysis or indexing.
- Detecting or categorizing file contents.
- Any purpose beyond the specific migration transfer.

---

## 8. Post-Migration Behavior

### 1.I What Happens After Migration Succeeds?

After a migration operation completes:

1. **The user is shown a result summary** listing each item: succeeded, failed, or skipped.
2. **Source files are NOT deleted.** They remain in Account A untouched.
3. **No automatic follow-up action is taken** by the tool.
4. **The user is informed** that their session data will be cleared when they
   disconnect or close the session.
5. **The user is reminded** that application access can be revoked from their
   Google Account security settings if they wish.
6. **No success metrics or file metadata are sent to any analytics service.**

> The initial MVP will have no deletion feature. The migration result is copy-only.

---

## 9. Requirements for a Future Deletion Feature

### 1.J What Must Happen Before Any Future Deletion Feature Could Be Allowed?

If a future version adds an optional source-deletion capability, ALL of the
following requirements must be met before it ships:

1. **Separate, isolated UI flow.** Deletion must be on a distinct screen, never
   presented as a checkbox alongside migration confirmation.
2. **Explicit item-level confirmation.** The user must see the exact list of
   items that will be deleted and confirm each batch.
3. **Mandatory verification gate.** The system must verify (with a confirmation
   API check) that the destination copy exists and is accessible before deletion
   is even offered as an option.
4. **Time-delay safety mechanism.** A mandatory cooldown period (e.g., 24 hours)
   between migration completion and deletion availability should be considered.
5. **No automatic "clean up source" toggle.** There must be no opt-in setting
   that auto-deletes on future runs.
6. **Audit log for the user.** The user receives a complete record of what was
   deleted, downloadable before the deletion action completes.
7. **Revocability of deletion request** during the cooldown period if implemented.
8. **Additional OAuth scope justification.** The `drive.file` or `drive` delete
   scope must be separately documented and requested only at deletion time, not
   at migration time.

---

## 10. Minimum Permissions — Operational Definition

### 1.K What Does "Minimum Permissions" Mean Operationally?

"Minimum permissions" is not a general principle — it is an operational rule with
specific enforcement mechanisms:

#### Rule 1: Scope Justification Table

For every OAuth scope requested, a written entry must exist in the codebase
(e.g., a `SCOPES.md` file) containing:
- The exact scope string.
- The Google service it grants access to.
- The specific feature in our product that requires it.
- Why no narrower scope can substitute.
- What happens if the user denies this specific scope.

#### Rule 2: Scope Minimality Test

Before adding any scope, ask:
1. Is there a more restricted scope that covers this use case?
2. Can the feature be redesigned to need a narrower scope?
3. Is this scope required for MVP, or is it for a future feature?

If the answer to question 3 is "future feature," the scope MUST NOT be requested
in the current version.

#### Rule 3: Incremental Scope Request

Scopes should be requested at the moment they are needed, not all at once at login.
- Drive listing scopes: requested when user initiates Drive selection.
- Photos scopes: requested when user initiates Photos selection.
- Upload scopes for destination account: requested when user confirms migration.

#### Rule 4: No "Just in Case" Scopes

Requesting the broadest available Drive scope when a narrower scope covers the use
case is forbidden. The convenience of a single broad scope does not justify the
privacy cost.

> ⚠️ **Note:** Specific scope names (e.g., `drive.readonly`, `drive.file`) mentioned
> elsewhere in this document are **illustrative placeholders only**. The exact minimal
> scope set required for each feature must be confirmed against current Google
> documentation before implementation. See `docs/open_questions.md` question OQ-D-02.

---

## 11. Non-Goals for the Initial Version

The following are explicitly NOT goals for the initial version:

- ❌ Gmail migration of any kind
- ❌ Automatic full-account export or backup
- ❌ Deletion of source data
- ❌ Google Workspace / organizational account support
- ❌ Shared Drive support
- ❌ Google Contacts, Calendar, Keep, Maps, or YouTube migration
- ❌ Scheduled or recurring migration runs
- ❌ Migration without active user session
- ❌ Mobile application
- ❌ Persistent server-side storage of user files or credentials
- ❌ Analytics or telemetry on file contents
- ❌ Multi-user or team features
- ❌ Ownership transfer as an MVP feature — *(whether it is technically possible between personal accounts is an open research question; it is excluded from MVP regardless of the answer — see OQ-D-OT-01)*
- ❌ Migrating Google account settings or preferences

---

*Document status: Planning draft. No implementation exists. No Google APIs have been accessed.*
