# Integrations

## Persistence and backup

Story is a **local-first, user-owned app**. It works immediately, offline, with no account. The local database is the source of truth, and every backup layer is optional and visible.

> **Local Story → portable export → optional Google Drive backup**

Someone can open the public app on a new device and either start a completely private Story from scratch or restore an existing one, without a Story account.

### Local persistence

- Primary data in **IndexedDB**, single-document
- `navigator.storage.persist()` requested on launch, so data is not routinely evictable
- Explicit `schemaVersion` with an ordered migration runner
- Automatic pre-change backups in a separate store, last 3 retained, written before any migration, restore or Story deletion
- Import / restore from an exported file, with shape validation and a confirmation naming what will be replaced
- Export format is plain, readable JSON

**Restore replaces rather than merges.** Merging would mean resolving duplicate IDs; replace is predictable, and the automatic pre-restore backup is the safety net.

### Google Drive backup

Drive is a backup layer, never the database.

- Optional **Connect Google Drive** in the data footer
- Scope is `drive.file` only, so Story can only ever see files it created itself, never the rest of the Drive
- Creates a visible `Story` folder in My Drive holding `story-current.json` plus the last 3 dated snapshots
- Backs up on launch and 8s after any change, only when connected and online
- Every Drive failure is non-fatal; the local database stays the source of truth

The user can open, copy, move or delete those files themselves, and the footer shows when the last backup was made. Nobody should have to understand cloud folders or syncing in order to use Story.

The OAuth client ID is public by design for browser apps, and there is no client secret in this flow. The consent screen is in Testing mode with a single test user, so a one-time unverified-app screen is expected.

**Known limitation:** the browser token flow issues short-lived tokens and no refresh token, so reconnecting roughly once per session is expected. The token is held in `sessionStorage` so a page refresh does not re-prompt, and automatic backups never open a sign-in window: without a live token they skip, and the footer button changes to invite an explicit reconnect. GIS shows a popup even for a "silent" refresh, so triggering one automatically turns every refresh into a sign-in prompt. Removing that would need a server, which would break the local-first principle. Backups also only run while the app is open; there is no background sync on the web.

### Not built

**Restore from Drive on another device.** The intended flow is: open Story → connect Google Drive → Story finds your backup → confirm restore → continue. It must never silently overwrite local data: back up the current state first and identify which version is being restored. Until this exists, moving devices means exporting a file and restoring it by hand.

**Multi-device sync.** Explicitly separate from backup, and not part of the MVP. It introduces conflicting changes, merge behaviour, concurrent edits and offline changes on several devices at once. Reliable local persistence plus transparent backup comes first.
