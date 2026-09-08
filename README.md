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

**First launch** starts on a blank slate. Set an optional North Star, then create your first Story. No seed data, no required setup beyond that.

## Where your data lives

All Stories, Chapters, Goals, Steps, and Journey entries are stored on your device only. Nobody else can see them, not even via this repo, which only contains app *code*, never your personal data.

Data is stored in **IndexedDB**, and the app asks the browser for *persistent storage* on launch so it is exempt from routine eviction. The footer shows when you last exported and warns if the browser declined to protect your storage.

Even so, **export regularly** using the **⇩ Export data** button. Uninstalling the app or clearing site data will still remove everything, and there is no cloud copy until Phase 2.

---

## Repository layout

```text
index.html              the entire app: styles, markup and script inline
manifest.json           PWA metadata
service-worker.js       network-first for the shell, cache-first for assets
tests/                  no-dependency test suite, reads index.html directly
AGENTS.md               standing instructions for working on this repo
```

Inside `index.html`, grep for section markers rather than scanning:
`SECTION: tokens`, `styles-poster`, `persistence`, `derivations`, `views`,
`modals`, `backup`. Line numbers go stale; markers don't.

### Why one file

Deliberate, not an accident of growth.

- **Atomic deploy.** The styles, markup and script that ship together are always the versions that were tested together.
- **The service worker makes splitting risky.** It is network-first for the HTML shell but cache-first for everything else, so a separate `app.js` could be served stale against a fresh `index.html`. Splitting would mean reworking the caching strategy in the same change.
- **No build step**, which keeps the app editable from anywhere and removes a whole category of tooling failure.

The cost is that tests need `tests/harness.js` to pull functions out of the inline script. That is a fair price. If the file passes roughly 2500 lines, split `SECTION: backup` out first, since it is the largest band with the least coupling, and change the service worker in the same commit.

### Tests

```
node tests/run.js
```

No dependencies, no install step. The suite reads `index.html`, extracts named functions from the inline script, and exercises the real source rather than a copy. CI runs the same command on every push.

`tests/conventions.test.js` holds the project rules as assertions, including three ratchets (duplicate selectors, unused classes, inline styles) whose ceilings may only be lowered. AGENTS.md states the conventions; this is what enforces them.

The **derivations** band is where testable logic belongs: pure functions that take state and return data. Anything deciding what is shown, in what order, or what a count is goes there rather than inside a renderer. Renderers turn data into HTML and nothing more.

When refactoring for speed or tidiness, keep the old implementation in the test and assert the new one matches it. `tests/selectors.test.js` is the pattern.

## Data model

The whole state is a single record in IndexedDB (see the single-document decision below). Current `schemaVersion` is **2**.

```text
Story  (state.quests)
  └── Chapter  (state.subs)          sub.questId → Story
        └── Goal  (state.goals)      goal.subQuestId → Chapter (nullable)
              └── Step  (state.tasks)    task.goalId → Goal (nullable)

Journey  (state.activities)          activity.questId → Story
```

Every item also carries `questId`, so a Story's contents can be fetched without walking the tree.

**Internal names differ from the UI names**, for historical reasons. Don't rename these casually; a rename means a migration:

| UI name | State key | Notes |
|---|---|---|
| Story | `quests` | `id`, `name`, `icon`, `attention`, `status` |
| Chapter | `subs` | `id`, `questId`, `title`, `status` |
| Goal | `goals` | `id`, `questId`, `subQuestId`, `title`, `detail`, `status` |
| Step | `tasks` | `id`, `questId`, `goalId`, `title`, `status`, `completedAt`, `mode`, `anchor`, `lastMarkedAt` |
| Journey entry | `activities` | `id`, `questId`, `taskId`, `note`, `date`, `kind` |

Relationships are **real foreign key fields**, not a generic tag or polymorphic relation system.

### Steps and Practices

A Step has two modes, held in `task.mode`:

- `"once"` (the default, and what an absent `mode` means) is the original behaviour. It completes, and it leaves the list.
- `"practice"` is a habit. It never completes. Marking it writes a Journey entry and leaves the record open, so it stays on the Story page.

They share one record deliberately. A Practice is not a separate entity, it is a Step with a different relationship to time.

Rules that hold the mechanic together:

- **Mark it as often as you do it.** There is no per-day limit. The count records times, not days, so walking twice on a Tuesday is two marks.
- **The count is derived**, from Journey entries carrying that `taskId`. It is never stored, so it can only ever reflect something that actually happened.
- **Nothing is one-way.** Every Journey entry that came from a step or a practice carries a ticked checkbox. Unticking it removes the entry, and either puts the step back on the list or removes that single mark. `lastMarkedAt` is recomputed from surviving entries rather than cleared.
- **Presence only, never absence.** The UI shows marks made. It has no cadence target, no denominator, and therefore no shortfall. An unmarked day produces no entry and no indicator. There is deliberately no way to express "3x a week", because a target creates a deficit.
- `anchor` is the implementation intention ("after morning coffee"), prompted but never required.

A Step links to its Chapter *transitively*, through its Goal. Steps have no direct chapter field. There used to be an unused `task.subQuestId` (always written as `null`, never set by any UI); it was removed when the hierarchy was settled.

### Deleting things

All five delete paths run through one rules table, `DELETE_RULES`, with `deleteImpact()`, `deleteMessage()` and `applyDelete()` on top of it.

| Deleting | What happens |
|---|---|
| Chapter | Its goals are **unfiled**, not deleted |
| Goal | Its steps are **unfiled**, not deleted |
| Step | Removed. Its Journey entries stay |
| Journey entry | Just that entry |
| Story | Everything in it, after writing a backup |

The confirmation sentence is generated from the same impact the deletion uses, so the promise and the behaviour cannot drift apart. Before this, Step deletion promised Journey entries would survive while Story deletion silently destroyed them.

Still to change, once a timeline view exists: a deleted Story should keep its Journey entries rather than destroying them. They are held back only because every current view finds entries by Story, so preserved entries would be invisible.

### Migrations

- **v1** stripped per-item `points` and `goal.progress`, both deliberately removed features
- **v2** renamed `goal.target` to `goal.detail`, carrying existing text across rather than dropping it

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
- ✅ Explicit **schema versioning** (`schemaVersion`, currently 2) with an ordered migration runner
- ✅ Automatic **pre-change backups** kept in a separate store, last 3 retained, written before any migration or restore
- ✅ **Import / Restore** from an exported file, with shape validation and an explicit confirmation naming what will be replaced
- ✅ One-time automatic migration of existing `localStorage` data on first launch
- ✅ Export format stays plain, readable JSON

The local database is the source of truth. The app works fully offline with no account.

**Restore replaces rather than merges.** Merging would require resolving duplicate IDs; replace is predictable, and the automatic pre-restore backup is the safety net.

### Phase 2, user-owned Google Drive backup — DONE

- ✅ Optional **Connect Google Drive** in the data footer
- ✅ Scope is `drive.file` only, so Story can only ever see files it created itself, never the rest of the user's Drive
- ✅ Creates a visible `Story` folder in My Drive, holding `story-current.json` plus the last 3 dated snapshots
- ✅ Backs up on launch and 8s after any change, only when connected and online
- ✅ Every Drive failure is non-fatal; the local database stays the source of truth

The OAuth client ID is public by design for browser apps, and there is no
client secret in this flow. The consent screen is in Testing mode with a
single test user, so a one-time unverified-app screen is expected.

**Known limitation:** the browser token flow issues short-lived tokens and
no refresh token, so reconnecting roughly once per session is expected.
The token is held in `sessionStorage` so a page refresh does not re-prompt,
and automatic backups never open a sign-in window: without a live token they
skip, and the footer button changes to invite an explicit reconnect. GIS
shows a popup even for a "silent" refresh, so triggering one automatically
turns every refresh into a sign-in prompt.
Removing that would need a server, which would break the local-first
principle. Backups also only run while the app is open; there is no
background sync on the web.

#### Original intent

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

**If you're using the installed PWA and a change doesn't seem to show up:** the service worker is network-first for the app shell, but an already-open PWA still has the *previous* service worker in control until it's replaced. Fully close the app (not just background it) and reopen it; if it still looks stale, do that once more. This was a real bug once already (`CACHE_NAME` never changed, fetch was strict cache-first) — see git history around the "stale index.html" fix if it resurfaces.

---

## Current status

MVP prototype. The core Story → Chapter → Goal → Step → Journey loop is functional.

### Current priorities

Product, roughly in order:

1. **Events and the timeline.** Events are objective things on a date (dentist, a birthday), separate from Steps and with no due-date semantics. The timeline is one spine scrolled both ways: events ahead, Journey behind. Optional `questId`, since not everything belongs to a Story.
2. **`.ics` export.** One event at a time, using the event id as `UID` so re-exporting updates rather than duplicating. One-way and a copy; no OAuth, no sync.
3. **Deleted Stories keep their Journey entries.** Blocked until the timeline exists, because every current view finds entries by Story, so preserved entries would be invisible. Denormalise the Story name onto them as text.
4. **A derived line on the Story page**, stating something true about the record ("part of your life since March, 14 marks"). Needs a Story start date; `createdAt` exists on newer Stories, older ones may need backfilling.
5. **The return band.** After a quiet stretch, home opens with something the person wrote and how long the Story has existed. Triggered off the date of the most recent Journey entry, never off a stored "last opened", so it responds to the story being quiet rather than tracking the person. No call to action, never a modal, never mentions the gap.
6. **Practice endings.** `resting` and `woven` statuses, so a practice can be set down or graduate instead of only being deleted.
7. **Monthly Issue.** Cut by accumulation rather than by calendar, so it never has a thin month. Entries selected by structural rule only (the first time, where it started), never by sentiment, and the rule is stated as the section heading so nothing feels cherry-picked.

Codebase, whenever there is appetite:

- **Modal shell.** The four `openEdit*` functions share one skeleton; extract it, keeping each delete cascade explicit rather than config. Worth doing before Events, so Events is configuration rather than a fifth copy.
- **CSS consolidation.** 37 selectors have more than one base-layer definition, and each breakpoint has two media blocks. `tests/conventions.test.js` holds the count as a ceiling that may only fall.
- **File split.** Optional and last. Requires changing the service worker to network-first for all same-origin assets in the same commit. See [Why one file](#why-one-file).

Design principles that constrain all of the above are in [Visual direction](#visual-direction) and [Deliberately removed](#deliberately-removed).

### Visual direction

The look is editorial and printed: cream paper, warm black ink, serif for anything that speaks.

- **Ink colours, not screen primaries.** Accents are `--olive`, `--terracotta`, `--gold`, `--blue`. Saturated primaries were tried (`--poster-*`) and removed: full-chroma colour is lit, the paper is reflected, and the two don't share a light source. They also compete with any photo or artwork a Journey entry might carry later, which should be the strongest colour on screen.
- **`--signal-red` is reserved for destructive actions.** It appeared on every step trigger, which meant it signalled nothing and read as a row of demands. If red is on a routine control, that is a bug.
- **Emphasis is the app's only editorial voice, and it belongs to the record, not the controls.** One loud thing per screen, and it should be a fact about what the person has actually done.
- **Uppercase is for small labels only** (eyebrows, kickers, field labels). Headings and Story names are sentence case. Uppercasing something 35px tall is shouting.
- **State presence, never absence.** No empty slots waiting to be filled, no cadence targets, no shortfall.

### Home views

Home has two views behind a toggle: **Stories** (the default) and **Steps**.

Steps is a flat list of every open one-off step across every active Story, newest first, each tagged with the Story it belongs to. No grouping and no counts, so it reads as what's in motion rather than as a backlog.

- **Practices are excluded.** A list of practices not yet marked today is a list of absences, and the app does not show absence.
- **Newest first**, because oldest-first surfaces the stalest thing, which is quietly accusing. There are no due dates and there will not be any.
- **The toggle is not persisted.** The app opens on Stories every launch, not on a list of everything outstanding.

### Deliberately removed

- **Points.** The variable point economy (+1/+2/+3/+5) has been removed entirely, from the UI and the data model. The Journey count ("3 steps taken") is now the only progress signal, because it is the only honest one.
- **Goal progress percentages.** Removed rather than left showing a permanent 0%. A real progress model is wanted, but it should be designed deliberately rather than faked.
- **The North Star.** A display-only string that nothing else in the app read, and which became invisible in daily use. Removed from markup, state and CSS rather than hidden.
- **The goal hero panel.** It repeated the leading goal that the Goals list showed directly below it. The leading goal is now just emphasised in the list.
- **The yellow corner square on the Main Story card.** A rotated decorative shape that repeatedly escaped its parent on mobile. Removed outright rather than tuned again. Don't reintroduce offset or rotated decoration that depends on `overflow:hidden` to stay inside its card.
- **Goal "target".** The field was free text that read as a measurable target it never was. Renamed to "detail" in v2, not deleted.

### Design decisions

- Main Story card is **blue**. (The North Star was retired; see Deliberately removed.)
- "Plan the next step", not "Take a Step". The panel is a queue of upcoming steps, so the label shouldn't imply they're already done. The separate **＋ Log** action is for recording what actually happened.
- Story detail is three sections: **Direction** (goals nested under their chapter, with a trailing "Not in a chapter" block), **Next step**, and **Journey**. Chapters and Goals were separate panels; merging them made the chapter/goal relationship visible instead of implied.
- Row actions are quiet **✎ icon buttons**, not "Edit" text. Six repeated "Edit" labels competed with the content for attention.
- Section kickers were dropped. Three panels all labelled "DIRECTION" said nothing.
- **Deleting a parent never destroys its children.** The rules and the reasoning are in [Deleting things](#deleting-things); they live in one table in the code so the confirmation text and the behaviour cannot drift apart.
- Completed Goals and dormant Chapters stay **visible but quiet** on the Story page rather than disappearing, so there is always a route back to editing them. Never a red failure signal. The pickers and the featured goal use the filtered `goals()`/`subs()`; the Story page uses `allGoals()`/`allSubs()`.
- Dates use **local** calendar time, never `toISOString()`, which is UTC and stamps the previous day after midnight in a positive-offset timezone.

### Known open items

- Practices have no ending yet. A Practice can only be deleted, not set down or marked as "woven in" (this is just what I do now, stop counting). A `status` of `resting` / `woven` is the intended next move
- A Practice can only be created by adding a Step and converting it in the edit modal. Quick-add always produces a one-off, deliberately, to keep that row a single field
- Converting an existing Step to a Practice brings the record forward but not its history: earlier one-off completions of the same activity stay as separate records and don't gather into the mark count
- Practices appear in the home page "Next steps" teaser alongside one-off steps, undifferentiated
- Completed steps aren't listed anywhere outside the Journey, though they can now be reopened from there. The Journey records it either way
- What a Chapter should *be* is still open. In practice they are mostly year-shaped ("2026: becoming a musician") but not always, so no year field has been formalised
- The Story page is macro; there is no focused "what do I do now" view yet
- Two old steps still carry a legacy `subQuestId: null`, and `completedAt` is date-only while `createdAt` is a full ISO timestamp. A schema v3 could tidy both
- The stylesheet still has stacked override layers (`.story-card` x7, `.main-story` x4, three `@media(max-width:900px)` blocks). This is what caused the oversized-input bug; consolidation is pending
- "Monthly Issue" (a magazine-style summary of your Journey, with photos) is planned but not started. The data model doesn't yet support attaching photos to Journey entries.
