# Story

A personal life navigator, one Story at a time, one Step at a time.

Story helps you keep track of the different parts of your life (career, writing, health, whatever matters to you), see what's currently in motion, and take one small step forward, without turning your life into a productivity dashboard you have to maintain.

This is a personal, single-user prototype. It is not a multi-user product.

> **Story is local-first. Cloud backup is optional. The user's data is portable and visible.**

---

## What it is

A single-file web app (HTML/CSS/JS, no build step, no framework) that:

- Organises your life into **Stories** (enduring areas), each with optional **Chapters** (seasons/arcs), **Goals** (outcomes), and **Steps** (small actions). A Chapter groups Goals; a Step belongs to a Goal, not directly to a Chapter
- Keeps a chronological **Journey**, a record of what you've actually done, not just what's planned
- Runs entirely in your browser, installable to your Android home screen as a standalone app (PWA)
- Stores all data locally on your device, nothing is sent to a server

## Using it

**Live app:** https://cdhwrd.github.io/story-app/

**Install to your home screen (Android/Chrome):**
1. Open the link above in Chrome
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**)
3. It opens full-screen with its own icon, like any other installed app

**First launch** starts on a blank slate: create your first Story and go. No seed data, no setup.

## Where your data lives

All Stories, Chapters, Goals, Steps, and Journey entries are stored on your device only. Nobody else can see them, not even via this repo, which only contains app *code*, never your personal data.

Data is stored in **IndexedDB**, and the app asks the browser for *persistent storage* on launch so it is exempt from routine eviction. The data footer shows when you last exported and warns if the browser declined to protect your storage.

Backup is yours to hold, in two forms, both optional:

- **⇩ Export data** writes a plain JSON file you keep wherever you like. Restore it with **⇧ Restore from file**, or **⇧ Paste backup** when moving between browsers makes a file awkward to hand over.
- **Connect Google Drive** keeps a copy in a visible `Story` folder in your own Drive. See [Google Drive backup](docs/integrations.md#google-drive-backup).

**Export regularly anyway.** Uninstalling the app or clearing site data removes the local database, and Drive backup only runs while the app is open.

---

## Current status

MVP prototype in daily use. The core Story → Chapter → Goal → Step → Journey loop is functional.

## Documentation

Read the one you need; none of them assume the others.

| Document | Covers |
|---|---|
| [Architecture](docs/architecture.md) | Repository layout, why one file, the test suite and harness |
| [Data model](docs/data-model.md) | Entities, relationships, deletion, migrations |
| [Design](docs/design.md) | Visual direction, home views, what the app deliberately does not have |
| [Integrations](docs/integrations.md) | Local persistence, Google Drive backup, what is not built |
| [Roadmap](docs/roadmap.md) | Current priorities and known open items |

`AGENTS.md` is the operating contract for AI coding agents working in this repo.

## Running the tests

```
node tests/run.js
```

No dependencies and no install step. CI runs the same command on every push. See [Architecture](docs/architecture.md#tests).

## Data ownership principle

Story is **local-first and user-owned**. It does not require:

- a Story account
- a Story-hosted cloud database
- a permanent internet connection
- proprietary data storage
- a hidden server-side copy of personal information

The public GitHub repository contains the application code, not users' personal Stories.

A user can move their Story between devices using a portable export without depending on Story's continued existence as a service.

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

**If you're using the installed PWA and a change doesn't seem to show up:** the service worker is network-first for the app shell, but an already-open PWA still has the *previous* service worker in control until it's replaced. Fully close the app (not just background it) and reopen it; if it still looks stale, do that once more.

---
