# Story

A personal life navigator, one Story at a time, one Step at a time.

Story helps you keep track of the different parts of your life (career, writing, health, whatever matters to you), see what's currently in motion, and take one small step forward, without turning your life into a productivity dashboard you have to maintain.

This is a personal, single-user prototype. It is not a multi-user product.

> **Story is local-first. Cloud backup is optional. The user's data is portable and visible.**

---

## What it is

A single-file web app (HTML/CSS/JS, no build step, no framework) that:

- Organises your life into **Stories** (enduring areas), each with optional **Chapters** (threads), **Goals** (outcomes), and **Steps** (small actions)
- Keeps a chronological **Journey**, a record of what you've actually done, not just what's planned
- Runs entirely in your browser, installable to your Android home screen as a standalone app (PWA)
- Stores all data locally on your device, nothing is sent to a server

## Using it

**Live app:** https://cdhwrd.github.io/story-app/

**Install to your home screen (Android/Chrome):**
1. Open the link above in Chrome
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**)
3. It opens full-screen with its own icon, like any other installed app

**First launch** starts on a blank slate. Set an optional North Star, then create your first Story. No seed data, no required setup beyond that.

## Where your data lives

All Stories, Goals, Steps, and Journey entries are stored in your browser's local storage, scoped to your device only. Nobody else can see it, not even via this repo, which only contains app *code*, never your personal data.

Data is stored in **IndexedDB**, and the app asks the browser for *persistent storage* on launch so it is exempt from routine eviction. The sidebar shows when you last exported and warns if the browser declined to protect your storage.

Even so, **export regularly** using the **⇩ Export data** button. Uninstalling the app or clearing site data will still remove everything, and there is no cloud copy until Phase 2.

---

## Persistence, Backup & Restore Roadmap

Story is designed as a **local-first, user-owned app**.

The app should work immediately without an account or cloud connection. A person's Story lives on their device, and any optional backup should go somewhere they can see, control, copy and restore themselves.

The long-term model is:

> **Local Story → portable backup → optional Google Drive backup**

The aim is that someone can open the public Story app on a new device and either start a completely private Story from scratch or restore an existing Story without needing a Story account.

### Phase 1, make local persistence dependable — DONE

- ✅ Primary data moved from `localStorage` to **IndexedDB** (single-document; the whole state is one record)
- ✅ `navigator.storage.persist()` requested on launch, so data is not routinely evictable
- ✅ Explicit **schema versioning** (`schemaVersion`, currently 1) with an ordered migration runner
- ✅ Automatic **pre-change backups** kept in a separate store, last 3 retained, written before any migration or restore
- ✅ **Import / Restore** from an exported file, with shape validation and an explicit confirmation naming what will be replaced
- ✅ One-time automatic migration of existing `localStorage` data on first launch
- ✅ Export format stays plain, readable JSON

The local database is the source of truth. The app works fully offline with no account.

**Restore replaces rather than merges.** Merging would require resolving duplicate IDs; replace is predictable, and the automatic pre-restore backup is the safety net.

### Phase 2, user-owned Google Drive backup

Google Drive should be an **optional backup layer**, not the application's database.

The intended experience is:

1. User chooses **Connect Google Drive**
2. Story asks for permission to manage the files it creates
3. Story creates a visible `Story` folder in the user's Google Drive
4. The app maintains a current Story backup there
5. The user can open, copy, move or delete the files themselves
6. Story shows when the last backup was made

The important product principle is transparency:

> **Your Story is yours, and you can see where it is stored.**

The app should not require users to understand cloud folders, databases or syncing in order to use Story.

### Phase 3, restore on another device

A new device should be able to discover an existing Story backup and restore it.

The intended flow is:

> Open Story → Connect Google Drive → Story finds your backup → Confirm restore → Continue your Story

Restoring should never silently overwrite existing local data. The app should first create a local backup of the current state and clearly identify which Story version is being restored.

### Phase 4, consider multi-device sync later

True synchronisation between multiple devices is explicitly separate from backup.

That introduces additional complexity around conflicting changes, merge behaviour, concurrent edits, and offline changes on multiple devices.

This is **not part of the current MVP plan**. The first goal is reliable local persistence plus simple, transparent backup and restore.

---

## Data ownership principle

Story should remain **local-first and user-owned**.

The product should not require:

- a Story account
- a Story-hosted cloud database
- a permanent internet connection
- proprietary data storage
- a hidden server-side copy of personal information

The public GitHub repository contains the application code, not users' personal Stories.

A user should be able to move their Story between devices using a portable backup without depending on Story's continued existence as a service.

---

## Planned architecture

```text
                    STORY APP
                        │
              ┌─────────┴─────────┐
              │                   │
         Local Story         Optional backup
          IndexedDB          Google Drive
              │                   │
              └────── portable ───┘
                    .story file
```

The local database is the working copy.

Google Drive is a user-controlled backup and restore destination.

The portable `.story` format is the escape hatch: the user's data should remain usable outside the app.

---

## Updating the app

This repo is public (required for free GitHub Pages hosting), but that only exposes the app's code, never your personal data. Changes are pushed here by an AI agent on request, using a short-lived GitHub access token.

**Workflow for making changes:**

1. Go to `github.com/settings/personal-access-tokens/new` (fine-grained, preferred) or `github.com/settings/tokens` (classic)
2. Generate a new token:
   - **Fine-grained:** limit *Repository access* to `story-app` only, and set the **Contents** permission to **Read and write**
   - **Classic:** check only the `public_repo` scope (not the top-level `repo` box, which grants access to private repos too)
   - Set a short expiration (7 to 30 days)
3. Copy the token and paste it into the chat, along with what you want changed
4. The agent edits the code, commits, and pushes to `main`. GitHub Pages redeploys automatically within about a minute
5. **Once the changes are in, delete the token** rather than leaving it active

A token pasted into chat only ever grants write access to this one repository's code, never to your personal data, which never leaves your device.

---

## Current status

MVP prototype. The core Story → Goal → Step → Journey loop is functional.

### Current priorities

1. ~~**Persistence foundation**~~ — done, see Phase 1 above

2. **Backup**
   - portable `.story` export
   - optional Google Drive backup

3. **Product refinement**
   - Step lifecycle
   - Goal / Chapter relationships
   - responsive polish

Further product expansion should wait until these foundations are reliable.

### Deliberately removed

- **Points.** The variable point economy (+1/+2/+3/+5) has been removed entirely, from the UI and the data model. The Journey count ("3 steps taken") is now the only progress signal, because it is the only honest one.
- **Goal progress percentages.** Removed rather than left showing a permanent 0%. A real progress model is wanted, but it should be designed deliberately rather than faked.

### Known open items

- Chapters exist as a data object but aren't yet visually connected to the Steps and Goals within them
- No Import/Restore yet, Export only
- "Monthly Issue" (a magazine-style summary of your Journey, with photos) is planned but not started. The data model doesn't yet support attaching photos to Journey entries.
