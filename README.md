# Story

A personal life navigator — one Story at a time, one Step at a time.

Story helps you keep track of the different parts of your life (career, writing, health, whatever matters to you), see what's currently in motion, and take one small step forward — without turning your life into a productivity dashboard you have to maintain.

This is a personal, single-user prototype. It is not a multi-user product.

---

## What it is

A single-file web app (HTML/CSS/JS, no build step, no framework) that:

- Organises your life into **Stories** (enduring areas), each with optional **Chapters** (threads), **Goals** (outcomes), and **Steps** (small actions)
- Keeps a chronological **Journey** — a record of what you've actually done, not just what's planned
- Runs entirely in your browser, installable to your Android home screen as a standalone app (PWA)
- Stores all data locally on your device — nothing is sent to a server

## Using it

**Live app:** https://cdhwrd.github.io/story-app/

**Install to your home screen (Android/Chrome):**
1. Open the link above in Chrome
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**)
3. It opens full-screen with its own icon, like any other installed app

**First launch** starts on a genuinely blank slate — set an optional North Star, then create your first Story. No seed data, no required setup beyond that.

## Where your data lives

All Stories, Goals, Steps, and Journey entries are stored in your browser's local storage, scoped to your device only. Nobody else can see it — not even via this repo, which only contains app *code*, never your personal data.

This also means it's not backed up anywhere automatically. **Use the "⇩ Export data" button in the sidebar regularly** — it shares a JSON snapshot of everything via Android's share sheet (Drive, email, wherever you like). If you clear browser data, uninstall the app, or switch devices without exporting first, your data is gone for good.

## Updating the app

This repo is public (required for free GitHub Pages hosting), but that only exposes the app's code — never your personal data. Changes are pushed here by Claude on request, using a short-lived GitHub access token.

**Workflow for making changes:**

1. Go to `github.com/settings/tokens` (classic tokens) or `github.com/settings/personal-access-tokens/new` (fine-grained — preferred, since it can be scoped to just this repo)
2. Generate a new token:
   - **Fine-grained:** limit *Repository access* to `story-app` only, and set the **Contents** permission to **Read and write**
   - **Classic:** check only the `public_repo` scope (not the top-level `repo` box, which grants access to private repos too)
   - Set a short expiration (7–30 days)
3. Copy the token and paste it into the chat with Claude, along with what you want changed
4. Claude edits the code, commits, and pushes to `main` — GitHub Pages redeploys automatically within about a minute
5. **Once the changes are in, delete the token** (Settings → Developer settings → Tokens) rather than leaving it active — generate a fresh one next time

A token pasted into chat only ever grants write access to this one repository's code, never to your personal data, which never leaves your device.

## Current status

MVP prototype, personal use. Core loop (create Story → add Steps → complete Steps → see Journey) is functional.

**Known open items:**
- Goal `progress` is currently a manually-set number, not derived from actual Step completion
- Chapters exist as a data object but aren't yet visually connected to the Steps/Goals within them
- Data persistence uses `localStorage`; migrating to `IndexedDB` would be more durable
- No import/restore from an exported JSON file yet — export only
- "Monthly Issue" feature (a magazine-style summary of your Journey, with photos) is planned but not started — the data model doesn't yet support attaching photos to Activity entries
