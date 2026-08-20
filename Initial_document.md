# Google Account Migration Manager

## Project Status

This is a completely new project.

Previous implementations, code, databases, credentials, and architecture must NOT be reused directly. Previous discussions may only be used as conceptual research/reference when explicitly provided.

The project must be designed carefully from the beginning, with research and Proof of Concept validation before implementing major migration functionality.

---

# 1. Project Goal

The goal is to build a platform that helps users safely understand, plan, and perform migration of data between two Google accounts.

The primary use case is:

- Account A = source Google account
- Account B = destination Google account

A user may want to move or copy their Google Drive files and/or Google Photos to another Google account.

Potential reasons include:

- Running out of storage
- Moving away from an old Google account
- Consolidating multiple accounts
- Preserving important data before an account becomes unavailable
- Managing storage across multiple Google accounts

The project should eventually support migration-related workflows for:

1. Google Drive files
2. Google Photos

However, these are separate technical problems and must not be assumed to use the same architecture.

---

# 2. Core Security and Privacy Principle

The application must NOT automatically connect to, inspect, scan, read, download, modify, transfer, or delete user data merely because the application starts.

The user must explicitly initiate any account connection or action.

In particular:

- Do not automatically access Gmail.
- Do not request Gmail scopes unless there is a clearly justified future feature.
- Do not read email messages or attachments.
- Do not automatically list all Google Drive files.
- Do not automatically scan Google Photos libraries.
- Do not download file or media contents unless a future user explicitly initiates a specific transfer workflow.
- Do not automatically modify permissions.
- Do not automatically transfer ownership.
- Do not automatically copy files.
- Do not automatically delete source files.
- Do not perform destructive actions in the background.

OAuth authentication must be explicit and user initiated.

---

# 3. Current Scope

At the beginning of the project, the goal is NOT to immediately build the full migration engine.

The first stages should focus on:

1. Researching officially supported Google mechanisms.
2. Separating Google Drive and Google Photos capabilities.
3. Identifying what is technically possible for personal consumer Gmail accounts.
4. Identifying API restrictions and limitations.
5. Building isolated Proof of Concept experiments only when explicitly approved.
6. Designing a safe architecture based on verified results.

No bulk migration functionality should be implemented based purely on assumptions.

---

# 4. Important Previous Research and Concepts

The following concepts were identified during earlier project discussions and require proper verification before being treated as final architecture.

## Google Drive

Possible approaches previously identified:

### A. Ownership Transfer

For files owned by the source account, investigate whether ownership can be transferred to another personal Google account using officially supported Google Drive API permission flows.

Questions requiring verification include:

- Does the flow work between two personal consumer Gmail accounts?
- Does the destination need to explicitly accept ownership?
- Which file types are supported?
- How does storage quota change after ownership transfer?
- Are folders transferred recursively?
- What happens to files owned by third parties?
- What happens to comments, revision history, URLs, and permissions?

This approach is attractive because, if supported, it may be metadata/control-plane based rather than downloading and re-uploading file bytes.

### B. Server-Side Copy

Investigate the official Google Drive `files.copy` mechanism.

Questions include:

- Which file types can be copied?
- Can binary files be copied?
- Can Google Workspace files be copied?
- How are folders handled?
- Is the copy performed server-side by Google?
- Does the destination account need prior access?
- What metadata is preserved or lost?
- What happens to revision history?
- How does quota behave?
- What rate limits or throttling exist?

---

## Google Photos

Google Photos has significantly different restrictions from Google Drive.

### A. Partner Sharing

Partner Sharing is an official Google Photos user-facing feature.

Previously observed behavior:

- Account A can share photos with Account B.
- Account B can accept and save photos to its library.
- The exact storage/quota behavior has important conditions.
- It is primarily a Google-native UI workflow rather than something that should be assumed to be fully automatable through an API.

The application may eventually provide guided workflows around this, but it must not falsely claim that it performs an API migration if the actual process is manual.

### B. Google Takeout / Export

Google Takeout should be treated as an export/archive mechanism.

It should NOT automatically be described as a direct account-to-account Google Photos migration.

Potential flow:

Source account -> Google Takeout export -> downloaded/exported archive -> possible later import/upload

Questions include:

- What formats are exported?
- What metadata is preserved?
- What storage or bandwidth is required?
- Can the workflow be simplified without violating Google's supported APIs and policies?

### C. Google Photos Picker API

A previously researched possibility is an interactive user-selected workflow using the Google Photos Picker API.

The important conceptual model is:

1. The user explicitly opens a Google-native picker.
2. The user manually selects specific photos/videos.
3. The application receives access only to the items selected through the supported picker flow.
4. A future architecture may investigate transferring those explicitly selected bytes to a destination.

This must be researched and verified before implementation.

Important questions:

- Which scopes are currently supported?
- What exact media access is provided?
- How long are returned media URLs valid?
- Can large uploads/downloads be resumed?
- Can bytes be streamed instead of saved as complete files locally?
- Can original timestamps and EXIF metadata be preserved after upload?
- Can videos be handled correctly?
- What happens if a transfer fails halfway through?

---

# 5. Control Plane vs Data Plane

The project must explicitly distinguish between:

## Control Plane

Operations such as:

- OAuth connection initiated by the user
- Account selection
- Permission management
- Migration planning
- Listing only explicitly requested metadata
- Job state tracking
- Progress tracking
- Verification state
- User confirmations
- Audit logging

## Data Plane

Operations involving actual file/media bytes, such as:

- Downloading
- Uploading
- Streaming
- Copying through application infrastructure
- Temporary buffering

The project must never accidentally introduce a data plane while claiming to be metadata-only.

If a future transfer method handles bytes, this must be explicit in the architecture, UI, security model, and infrastructure design.

---

# 6. Safety Principles

The project must follow these rules.

### No automatic deletion

A successful transfer must never automatically cause source deletion.

Deletion, if ever supported, must require a separate explicit user action after verification.

### Verification before deletion

A future migration system should distinguish states such as:

candidate
-> selected
-> transferring
-> transferred
-> verified in destination
-> optionally cleared for deletion
-> deleted

The exact state machine should be designed later based on actual supported workflows.

### No silent background access

The system must not silently access Google account contents.

### Explicit user actions

Sensitive operations should require explicit user initiation.

### Least privilege

OAuth scopes must be minimized.

Do not request broad scopes merely for convenience.

### Separate test and real accounts

Potential Proof of Concept experiments should use disposable or explicitly designated test data/accounts wherever possible.

---

# 7. Important Constraints

The initial application is intended primarily for personal consumer Google accounts, including `@gmail.com`.

Do not assume that features available only to:

- Google Workspace
- Google Workspace administrators
- School accounts
- Enterprise accounts

will work for ordinary consumer Gmail accounts.

Any such difference must be clearly identified.

---

# 8. Research Before Implementation

Before implementing major migration functionality, verify:

## Drive

- Ownership transfer between personal accounts
- Pending owner/acceptance behavior
- Server-side copy behavior
- Folder handling
- Google-native file handling
- Binary file handling
- Quota behavior
- Metadata preservation
- Revision/history behavior
- Rate limits
- Failure/retry behavior

## Photos

- Current Google Photos API restrictions
- Current status of library-reading APIs/scopes
- Picker API capabilities
- Picker selection limits
- Media URL expiration
- Streaming capabilities
- Resumability
- Upload APIs and restrictions
- Metadata preservation
- EXIF timestamp behavior
- GPS behavior
- Video handling
- Partner Sharing storage behavior
- Takeout limitations

All time-sensitive API assumptions should be checked against current official documentation before implementation.

---

# 9. Proof of Concept Strategy

Do not jump directly into a bulk migration engine.

Instead, create isolated POCs one at a time.

Examples may include:

### POC 1
Transfer ownership of one disposable Google Drive file between two test accounts.

Verify:

- Whether it works
- Required acceptance flow
- Quota changes
- Metadata preservation

### POC 2
Server-side copy of one Drive file.

Verify:

- Source and destination behavior
- File type compatibility
- Quota behavior
- Metadata/history differences

### POC 3
Google Photos Picker selection of one test photo.

Verify:

- User interaction
- Available metadata
- Temporary URL behavior
- Expiration

### POC 4
One-photo transfer/upload experiment.

Verify:

- Original timestamp
- EXIF data
- GPS data if applicable
- File integrity
- Destination appearance

### POC 5
Interrupted transfer behavior.

Verify:

- Retry
- Resume capability
- Duplicate prevention
- Idempotency

No POC should access unrelated user data.

---

# 10. Architecture Direction

The final architecture must be decided after research and POC validation.

Potential components may eventually include:

- Frontend
- Backend API
- Explicit OAuth connection flow
- Migration job manager
- Provider-specific modules
- Google Drive migration module
- Google Photos migration module
- Job state persistence
- Audit logging
- Verification module
- Retry/resume system

However, this is not yet an implementation commitment.

Architecture should follow verified capabilities, not force Google services into a pre-decided design.

---

# 11. Questions That Must Remain Open Until Verified

Do not silently assume answers to these questions:

1. Can ownership of all relevant Drive files be transferred between two personal Gmail accounts?
2. What Drive file types cannot be ownership-transferred?
3. Can folders be transferred recursively?
4. Is server-side Drive copy suitable for large binary files?
5. What exactly happens to quota after each migration method?
6. Can Photos Picker media bytes be streamed reliably?
7. Can Picker media transfers be resumed?
8. Are original EXIF timestamps preserved after destination upload?
9. Is GPS metadata preserved?
10. How should videos be verified?
11. What happens when a transfer partially succeeds?
12. How can duplicate uploads be prevented?
13. What are the practical rate limits for bulk operations?
14. What infrastructure costs arise if the application streams bytes?
15. Can a useful product be built while keeping the user in control and minimizing access to sensitive data?

---

# 12. Development Rule

Do not implement functionality simply because it sounds technically possible.

For each major feature:

1. Research current official support.
2. Identify account-type limitations.
3. Identify security/privacy implications.
4. Build an isolated POC if necessary.
5. Verify the POC with test data.
6. Document the result.
7. Only then design the production implementation.

---

# 13. Immediate Next Step

The immediate next step is project discovery and architecture planning.

The first AI-assisted development task should:

- Read this README completely.
- Treat it as the initial project specification.
- Inspect the empty/new project structure.
- Do not create OAuth credentials.
- Do not connect any Google account.
- Do not request or access Gmail data.
- Do not access Google Drive contents.
- Do not access Google Photos contents.
- Do not implement migration functionality yet.

Instead, the first task should produce a structured project plan covering:

1. Recommended technology stack
2. Folder structure
3. Google Drive and Google Photos separation
4. Security model
5. OAuth strategy with explicit user initiation
6. POC sequence
7. Testing strategy
8. Proposed development phases
9. Open technical questions requiring official documentation verification

Implementation should begin only after the plan is reviewed and approved.