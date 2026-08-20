# Privacy and Security Rules

**Project:** Google Account Migration Tool  
**Version:** 0.1 — Planning Draft  
**Date:** 2026-08-17  
**Status:** Pre-implementation. These are binding constraints, not guidelines.

---

> [!IMPORTANT]
> Every rule in this document is a hard constraint. Rules are not suggestions.
> Any implementation that violates a rule in this document must be rejected at
> code review, regardless of convenience or performance benefit.

---

## 1. Gmail — Permanent Exclusion

### 1.H What Permissions Should NEVER Be Requested (Gmail)?

Gmail access is **permanently and unconditionally excluded** from this project.

**No implementation may ever:**

| Forbidden Action | Specific Prohibition |
|---|---|
| Request any Gmail OAuth scope | `gmail.readonly`, `gmail.modify`, `gmail.send`, `mail.google.com`, or any `https://mail.google.com/` scope |
| Read email messages | Not in any format (MIME, JSON, raw) |
| Read email headers | Even subject lines or sender addresses are forbidden |
| Read email attachments | Including Drive files attached to emails |
| Read email thread metadata | Even counts or labels |
| Access email labels | Including system labels (INBOX, SENT, etc.) |
| Search email content | No full-text or metadata search |
| Write or send emails | No draft creation, no sending |
| Access the Gmail API | `https://gmail.googleapis.com/*` is never called |

**Rationale:** Email is the highest-sensitivity data category in a Google account.
Gaining Gmail access — even read-only — would expose financial records, personal
communications, passwords, authentication codes, and private correspondence. There
is no minimum-scope path into Gmail that is compatible with this tool's privacy
requirements. The initial MVP has no use case requiring Gmail access.

---

## 2. Credential Security Rules

### Rule CS-1: No Credentials in the Frontend

OAuth access tokens, refresh tokens, client secrets, and client IDs used for
server-side API calls must never be:
- Embedded in JavaScript sent to the browser.
- Stored in browser localStorage, sessionStorage, or cookies accessible to JavaScript.
- Logged to browser console in a way that exposes them.
- Transmitted in URLs (query parameters or fragments).

**Security requirement (preserved for implementation):**
- OAuth credentials must never be transmitted to or stored in the browser (localStorage,
  sessionStorage, JavaScript-accessible cookies, URL parameters, or fragments).
- The browser must never receive raw OAuth access tokens or refresh tokens.
- The specific server-side architecture that satisfies this requirement (e.g., session
  model, in-memory store, proxy pattern) will be determined during the architecture
  planning phase based on verified API capabilities.

> ⚠️ This is a security requirement, not an implementation prescription. The mechanism
> by which it is achieved must be designed after POC research confirms which API flows
> are available. See `docs/open_questions.md` infrastructure questions.

### Rule CS-2: No Persistent Credential Storage

Google OAuth tokens must not be written to:
- Any database (SQL, NoSQL, file-based).
- Any log file.
- Any configuration file.
- Any third-party service.

Tokens exist in server-side memory for the duration of the user's active session.
When the session ends (disconnect, timeout, or server restart), tokens are discarded.

**Implication:** The user must re-authenticate on every new session. This is by design.

### Rule CS-3: Client Secret Protection

The OAuth client secret must be:
- Stored as an environment variable on the server, never hardcoded.
- Never included in version control (`.gitignore` must exclude all `.env` files).
- Never logged, even partially.
- Never returned in any API response.

### Rule CS-4: HTTPS Required

All communication between the user's browser and our application must occur over
HTTPS. HTTP connections must be rejected or redirected. Local development may use
HTTP only for `localhost` during development, and must never be deployed over HTTP.

### Rule CS-5: OAuth State Parameter

The OAuth authorization request must include a cryptographically random `state`
parameter. The server must validate this parameter on callback to prevent
CSRF attacks.

---

## 3. Data Access Rules

### Rule DA-1: No Silent Data Access

The application must not read, list, or access any Google data in the background
or without the user having initiated a specific action in the current session.

Specifically forbidden:
- Pre-fetching Drive file lists before the user requests Drive migration.
- Caching a user's full Drive or Photos listing on the server.
- Running any Drive or Photos API call that the user did not directly trigger
  through an explicit UI action in the current session.

### Rule DA-2: Metadata vs. Content Boundary

| Operation | Classification | Permitted When |
|---|---|---|
| Listing file names, sizes, MIME types, IDs | Metadata | User has opened the file selection UI |
| Reading file thumbnails (API-provided) | Metadata | User has opened the file selection UI |
| Downloading file bytes | Content | User has selected the file AND confirmed migration |
| Reading file text/data for indexing | Content | **NEVER PERMITTED** |
| Reading photo EXIF data | Content | Only if required for transfer and user has selected the photo |
| Storing any file bytes on our server | Content | **NEVER PERMITTED** (pass-through only, zero persistence) |

### Rule DA-3: No Content Inspection

The application must not inspect, analyze, classify, or index the content of any
file. This includes:
- Text extraction from documents.
- Image analysis or object detection.
- Virus or malware scanning (this is the destination Google account's responsibility).
- Duplicate detection based on content hashing.
- File content logging.

### Rule DA-4: Bytes Are Pass-Through Only

When a binary file must travel through our infrastructure (stream-through copy):
- Bytes must be streamed directly from the Google Drive download API response to
  the Google Drive upload API request.
- No byte may be written to disk on our server.
- No buffer larger than the minimum required for streaming should be held in memory.
- The stream must be closed immediately upon completion or failure.

### Rule DA-5: No Unauthorized Collection Expansion

The tool must not use access to Account A to discover, index, or enumerate data
beyond what the user explicitly navigates to in the selection UI. For example:
- If the user selects one folder, we must not silently traverse all sub-folders.
- If the user selects a file, we must not read other files in the same folder.
- Traversal of sub-folders must only happen if the user explicitly requests
  "include sub-folders" and is shown a summary of what will be traversed.

---

## 4. OAuth Scope Rules

### Rule SC-1: Scope Justification is Mandatory

No OAuth scope may be requested without a corresponding entry in `docs/SCOPES.md`
(to be created during implementation planning) that documents:

```
Scope: <exact scope URI>
Service: <Google service>
Required for: <specific product feature>
Minimum alternative considered: <narrower scope if exists, or "none">
User impact if denied: <what the user cannot do>
Requested at: <login time / feature time>
```

### Rule SC-2: Forbidden Scopes — Initial Version

The following scopes must NEVER appear in the initial implementation:

| Forbidden Scope | Reason |
|---|---|
| `https://mail.google.com/` | Gmail — permanently excluded |
| `https://www.googleapis.com/auth/gmail.*` | Gmail — permanently excluded |
| `https://www.googleapis.com/auth/drive` | Full Drive access — too broad; use narrower scopes |
| `https://www.googleapis.com/auth/drive.appdata` | Not needed |
| `https://www.googleapis.com/auth/contacts` | Out of scope for MVP |
| `https://www.googleapis.com/auth/calendar` | Out of scope for MVP |
| `https://www.googleapis.com/auth/youtube` | Out of scope for MVP |
| `https://www.googleapis.com/auth/userinfo.email` | Only if needed; justify if used |

> ⚠️ The full `https://www.googleapis.com/auth/drive` scope grants access to all
> files in Drive including files created by other applications and must NOT be used.
> The correct minimal scope set for Drive operations is **not yet confirmed** — it
> depends on the exact API flows available for cross-account migration. Scope names
> mentioned elsewhere in this document are illustrative placeholders only.
> Research is required before any scope is chosen. See `docs/open_questions.md`
> questions OQ-D-02 and OQ-D-06.

### Rule SC-3: Incremental Scope Request

Scopes are requested at the moment they are needed, not bundled at login:
- Scopes needed to browse Drive files: requested when user opens Drive selector.
- Scopes needed to upload to destination: requested when user confirms migration.
- Scopes for Photos: requested when user opens Photos selector.
- Scopes for the source account and destination account are separate OAuth grants.

### Rule SC-4: Scope Denial Must Be Handled Gracefully

If the user denies a scope:
- The application must not crash or show an unhandled error.
- The application must explain what feature is unavailable and why.
- The application must allow the user to continue with reduced functionality
  (e.g., skip Drive migration and proceed with Photos only).
- The application must never retry a denied scope automatically.

---

## 5. Session and State Rules

### Rule SS-1: Session Lifetime

User sessions must expire after a defined maximum period of inactivity (exact
duration TBD during implementation planning). After expiry:
- All server-side tokens are discarded.
- The user must re-authenticate.

### Rule SS-2: Account Isolation

The source account (Account A) and destination account (Account B) must be treated
as completely isolated OAuth sessions. A token for Account A must never be used
to make API calls intended for Account B, and vice versa.

### Rule SS-3: No Cross-Session Data

No data from one user's session may persist to another session. If sessions are
stored in a shared cache, each session must be keyed by a cryptographically random,
unpredictable session ID.

---

## 6. Logging Rules

### Rule LG-1: No PII in Logs

Application logs must never contain:
- User email addresses.
- File names (these are user data).
- File IDs (these can be used to reconstruct user activity).
- OAuth tokens or any part of them.
- IP addresses in a persistent log (ephemeral access logs acceptable, but must
  have a short retention period).

### Rule LG-2: Operational Logs Only

Logs should contain only operational data needed for debugging server errors:
- Timestamps.
- Error codes and messages (without user context).
- Request duration.
- HTTP status codes.

---

## 7. Deletion Rules

### Rule DL-1: No Automatic Deletion — Ever

The application must never automatically delete any file from either Google account,
under any circumstances, including:
- After a successful migration.
- On session expiry.
- As part of any "cleanup" routine.
- As a background task.

### Rule DL-2: Deletion is Out of Scope for MVP

Source deletion is not a feature in the initial version. No UI, no API call,
no delete scope must be present in the MVP.

### Rule DL-3: Requirements Gate for Future Deletion

If deletion is ever added in a future version, all requirements listed in
`docs/product_requirements.md` Section 9 must be met before it ships.

---

## 8. Dependency and Supply Chain Rules

### Rule DP-1: Dependency Audit

Every third-party library used in the implementation must be audited for:
- Whether it makes outbound network requests (forbidden for credential handling libraries).
- Whether it logs or stores user data.
- Whether it is actively maintained and has a security vulnerability policy.

### Rule DP-2: No Analytics or Telemetry SDKs

No analytics, crash reporting, or telemetry library (e.g., Google Analytics,
Sentry, Mixpanel, Segment) may be included without explicit review and user consent
mechanism. The MVP will contain no telemetry.

---

*Document status: Planning draft. These rules apply to all future implementation.
No implementation exists. No Google APIs have been accessed.*
