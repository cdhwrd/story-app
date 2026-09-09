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
- **Connect Google Drive** keeps a copy in a visible `Story` folder in your own Drive. See [Google Drive backup](#google-drive-backup).

**Export regularly anyway.** Uninstalling the app or clearing site data removes the local database, and Drive backup only runs while the app is open.

---

## Repository layout

```text
index.html              the entire app: styles, markup and script inline
rrule-2.8.1.min.js      vendored, the only dependency (see Why one file)
manifest.json           PWA metadata
service-worker.js       network-first for the shell, cache-first for assets
tests/                  no-dependency test suite, reads index.html directly
AGENTS.md               standing instructions for working on this repo
CLAUDE.md               imports AGENTS.md
.github/workflows/      CI: runs the test suite on every push
```

Inside `index.html`, grep for section markers rather than scanning:
`SECTION: tokens`, `styles-poster`, `persistence`, `derivations`, `views`,
`modals`, `backup`. Line numbers go stale; markers don't.

### Why one file

Deliberate, not an accident of growth.

- **Atomic deploy.** The styles, markup and script that ship together are always the versions that were tested together.
- **The service worker makes splitting risky.** It is network-first for the HTML shell but cache-first for everything else, so a separate `app.js` could be served stale against a fresh `index.html`. Splitting means reworking the caching strategy in the same change.
- **No build step**, which keeps the app editable from anywhere and removes a whole category of tooling failure.

**One vendored exception.** `rrule-2.8.1.min.js` (46KB, 13.6KB gzipped, UMD, no build step) expands recurrence rules. The argument against splitting is that a stale cached file could be served against a fresh `index.html`; a versioned third-party file cannot drift, because upgrading changes its name and busts the cache by itself. It is precached by the service worker alongside the shell. Recurrence is the one part of a calendar worth a dependency: `BYDAY`, `BYSETPOS`, `COUNT` versus `UNTIL` and DST are where hand-rolled code goes quietly wrong.

The cost is that tests need `tests/harness.js` to pull functions out of the inline script. That is a fair price. If the file passes roughly 2500 lines, split `SECTION: backup` out first, since it is the largest band with the least coupling, and change the service worker in the same commit.

### Tests

```
node tests/run.js
```

No dependencies, no install step. The suite reads `index.html`, extracts named functions from the inline script, and exercises the real source rather than a copy. CI runs the same command on every push.

`tests/conventions.test.js` holds the project rules as assertions: three ratchets (duplicate selectors, unused classes, inline styles) whose ceilings may only be lowered, a ban on failure and deadline language in UI copy, and a guard on the state vocabulary. AGENTS.md states the conventions; this is what enforces them.

`tests/persistence.test.js` covers the migration runner, the shape checks, and the import path. Nothing in the persistence band changes without a test.

`tests/modals.test.js` covers the modal building blocks, `tests/events.test.js` the event derivations, with particular attention to the exclusive all-day end, and `tests/ics.test.js` the calendar export by round trip.

The **derivations** band is where testable logic belongs: pure functions that take state and return data. Anything deciding what is shown, in what order, or what a count is goes there rather than inside a renderer. Renderers turn data into HTML and nothing more.

When refactoring for speed or tidiness, keep the old implementation in the test and assert the new one matches it. `tests/selectors.test.js` is the pattern.

## Data model

The whole state is a single record in IndexedDB (see [Why one document](#why-one-document)). Current `schemaVersion` is **3**.

```text
Story  (state.stories)
  └── Chapter  (state.chapters)      chapter.storyId → Story
        └── Goal  (state.goals)      goal.chapterId → Chapter (nullable)
              └── Step  (state.steps)    step.goalId → Goal (nullable)

Journey  (state.journey)             entry.storyId → Story
Event    (state.events)              event.storyId → Story (nullable)
```

Every item also carries `storyId`, so a Story's contents can be fetched without walking the tree.

| Entity | State key | Fields |
|---|---|---|
| Story | `stories` | `id`, `name`, `icon`, `attention`, `status` |
| Chapter | `chapters` | `id`, `storyId`, `title`, `status` |
| Goal | `goals` | `id`, `storyId`, `chapterId`, `title`, `detail`, `status` |
| Step | `steps` | `id`, `storyId`, `goalId`, `title`, `status`, `completedAt`, `mode`, `anchor`, `lastMarkedAt` |
| Journey entry | `journey` | `id`, `storyId`, `stepId`, `note`, `date`, `kind` |
| Event | `events` | `id`, `storyId`, `summary`, `description`, `location`, `start`, `end`, `recurrence`, `status` |

Relationships are **real foreign key fields**, not a generic tag or polymorphic relation system.

**Events are the one deliberate exception to the rule below.** They follow Google Calendar's event resource shape verbatim, so an `.ics` export and any later sync stay a mapping rather than a translation: `summary` not title, `description` not note, `start`/`end` as `{date}` or `{dateTime, timeZone}`. Alignment, not replication; there are no attendees, no VTIMEZONE and no per-occurrence overrides.

Two consequences worth knowing. All-day `end` is **exclusive**, the day after the last day, as Google has it, so a trip on the 25th to the 27th stores `end: 2026-09-28`; nothing a person reads touches `end` directly, it goes through `eventLastDate()`. And times are local wall clock plus an IANA zone, never `toISOString()`.

**`.ics` export** is written by hand against RFC 5545, not against what Google happens to accept: CRLF endings, TEXT escaping, and content lines folded at 75 **octets** rather than characters, since a Story icon is a four-byte emoji. `UID` is the record's own id, so re-importing the same event updates it rather than duplicating it. All-day `DTEND` goes out exactly as stored, because iCalendar wants it exclusive too, so both ends are a copy rather than a calculation. Timed events go out as local wall clock with a `TZID` parameter.

Correctness is held by a round trip in `tests/ics.test.js`: build a file, parse it with a parser written independently of the writer, and require the event to survive. It was cross-checked once against `ical.js` during development, which cannot live in the suite because the tests take no dependencies.

Export is one-way and a copy. No OAuth, no sync.

**Recurrence is expanded at read time and never stored**, the same way mark counts are derived. A birthday is one record, so editing it moves every occurrence. An *occurrence* is `{date, last, rec}`: the record plus the days it actually lands on. Expansion runs through UTC and comes back through `utcDateOf()`, because a repeating event is a wall-clock idea (a birthday is the 16th everywhere) and local time would drift it across a DST boundary. Views expand at most a year either way; a rule can run forever, a view cannot.

The modal offers Never, daily, weekly, monthly and yearly. A rule it cannot express, from an import or a future version, comes back as **Custom** and is written out untouched rather than downgraded to the nearest option.

**The state uses the UI's words, and only those.** A conventions test fails the build if `quests`, `subs`, `tasks`, `activities`, `questId`, `subQuestId` or `taskId` appear anywhere except the two places that must name them: `MIGRATIONS[3]`, and `PRE_V3_LISTS`, which is what lets an older export still restore.

Selectors scoped to a Story carry an `In` suffix, `chaptersIn(id)`, `stepsIn(id)`, `journeyIn(id)`, to keep them clear of the local variable names the renderers use (`story` is one). `goals(id)` and `allGoals(id)` are the exception; that word needs no qualifying.

### Steps and Practices

A Step has two modes, held in `step.mode`:

- `"once"` (the default, and what an absent `mode` means) completes, and leaves the list.
- `"practice"` is a habit. It never completes. Marking it writes a Journey entry and leaves the record open, so it stays on the Story page.

They share one record deliberately. A Practice is not a separate entity, it is a Step with a different relationship to time.

Rules that hold the mechanic together:

- **Mark it as often as you do it.** There is no per-day limit. The count records times, not days, so walking twice on a Tuesday is two marks.
- **The count is derived**, from Journey entries carrying that `stepId`. It is never stored, so it can only ever reflect something that actually happened.
- **Nothing is one-way.** Every Journey entry that came from a step or a practice carries a ticked checkbox. Unticking it removes the entry, and either puts the step back on the list or removes that single mark. `lastMarkedAt` is recomputed from surviving entries rather than cleared.
- **Presence only, never absence.** The UI shows marks made. It has no cadence target, no denominator, and therefore no shortfall. An unmarked day produces no entry and no indicator. There is deliberately no way to express "3x a week", because a target creates a deficit.
- `anchor` is the implementation intention ("after morning coffee"), prompted but never required.

A Step links to its Chapter *transitively*, through its Goal. Steps have no chapter field of their own.

### Deleting things

All five delete paths run through one rules table, `DELETE_RULES`, with `deleteImpact()`, `deleteMessage()` and `applyDelete()` on top of it.

| Deleting | What happens |
|---|---|
| Chapter | Its goals are **unfiled**, not deleted |
| Goal | Its steps are **unfiled**, not deleted |
| Step | Removed. Its Journey entries stay |
| Journey entry | Just that entry |
| Event | Removed. Nothing else is affected |
| Story | Everything in it, after writing a backup. Its events are **unfiled**, not deleted |

The confirmation sentence is generated from the same impact the deletion uses, so the promise and the behaviour cannot drift apart.

Open: a deleted Story should keep its Journey entries rather than destroying them. Held back only because every current view finds entries by Story, so preserved entries would be invisible.

### Migrations

An ordered runner brings any stored state up to `SCHEMA_VERSION`, writing a pre-change backup first. A version stamp means "everything up to here has already run", so a state stamped 2 enters at v3. An absent stamp means 0, which is what a state recovered from the old `localStorage` home looks like.

- **v1** strips per-item `points` and `goal.progress`, neither of which the product has
- **v2** renames `goal.target` to `goal.detail`, carrying existing text across rather than dropping it
- **v3** renames the state keys to the UI's words: `quests`→`stories`, `subs`→`chapters`, `tasks`→`steps`, `activities`→`journey`, `questId`→`storyId`, `subQuestId`→`chapterId`, `taskId`→`stepId`. It also drops the vestigial chapter field some older steps carry rather than renaming it, since a Step reaches its Chapter through its Goal and `step.chapterId` would look exactly like the live field on a Goal

**Adding a list costs no migration.** `withDefaultLists()` backfills any array in `DEFAULT_STATE` that a stored state lacks, so introducing `events` is one line there. `REQUIRED_LISTS` is excluded from that backfill and deliberately does not grow: requiring a new list there would reject every export written before it existed, and *inventing* a missing required list would turn "this state failed to convert" into "this person has no Stories", which reads as valid and would be written over real data on restore.

Rules for writing the next one:

- **Copy on presence, not truthiness.** `stepId` and `chapterId` are legitimately `null`, for a Journey entry typed by hand and a Goal filed under no Chapter. A truthiness test drops the key and changes what the record means.
- **Leave unknown keys alone.** A key this version has not heard of is somebody's data.
- **Make it idempotent**, so a half-applied run can be finished rather than reasoned about.
- **A rename is not activated in the same breath as it is written.** Bumping `SCHEMA_VERSION` before the code that reads the new shape has shipped moves stored data out from under the renderers. Land the migration dormant, bump it with the rename.
- **Validate before you migrate, and check the shape after.** `validateImport()` runs on a file that has not been migrated yet, so it accepts either shape; `isCurrentShape()` confirms the result before anything is overwritten.

The `backups` store is **write-only**: `writeBackup()` fills it and prunes to the last 3, but nothing reads it back, so there is no restore-from-backup UI. Snapshots are held in whatever shape was current when written, so the day that UI exists, it has to migrate them on the way out.

### Why one document

The whole state is one IndexedDB record rather than a store per entity. Every view reads across all five lists, writes are always whole-state, and the export format is the same object. Splitting it would buy partial reads the app never makes, and cost atomicity it depends on.

---

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

## Data ownership principle

Story is **local-first and user-owned**. It does not require:

- a Story account
- a Story-hosted cloud database
- a permanent internet connection
- proprietary data storage
- a hidden server-side copy of personal information

The public GitHub repository contains the application code, not users' personal Stories.

A user can move their Story between devices using a portable export without depending on Story's continued existence as a service.

## Architecture

```text
                    STORY APP
                        │
              ┌─────────┴─────────┐
              │                   │
         Local Story         Optional backup
          IndexedDB          Google Drive
              │                   │
              └────── portable ───┘
                     JSON export
```

The local database is the working copy. Google Drive is a user-controlled backup destination. The JSON export is the escape hatch: the data stays readable outside the app, in a format a person can open in any text editor.

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

**If you're using the installed PWA and a change doesn't seem to show up:** the service worker is network-first for the app shell, but an already-open PWA still has the *previous* service worker in control until it's replaced. Fully close the app (not just background it) and reopen it; if it still looks stale, do that once more.

---

## Current status

MVP prototype in daily use. The core Story → Chapter → Goal → Step → Journey loop is functional.

### Current priorities

Product, roughly in order:

3. **Deleted Stories keep their Journey entries.** Blocked until the timeline exists, because every current view finds entries by Story, so preserved entries would be invisible. Denormalise the Story name onto them as text.
4. **A derived line on the Story page**, stating something true about the record ("part of your life since March, 14 marks"). Needs a Story start date; `createdAt` exists on newer Stories, older ones may need backfilling.
5. **The return band.** After a quiet stretch, home opens with something the person wrote and how long the Story has existed. Triggered off the date of the most recent Journey entry, never off a stored "last opened", so it responds to the story being quiet rather than tracking the person. No call to action, never a modal, never mentions the gap.
6. **Practice endings.** `resting` and `woven` statuses, so a practice can be set down or graduate instead of only being deleted.
7. **Monthly Issue.** Cut by accumulation rather than by calendar, so it never has a thin month. Entries selected by structural rule only (the first time, where it started), never by sentiment, and the rule is stated as the section heading so nothing feels cherry-picked.

Events are done: the record, the timeline, the month grid, recurrence and `.ics` export. What remains on them is in Known open items, and skipping a single occurrence is the one most likely to bite.

Codebase, whenever there is appetite:

- **CSS consolidation.** 43 selectors have more than one base-layer definition, and the breakpoints repeat: three `@media(max-width:900px)` blocks and two at 560px. `tests/conventions.test.js` holds the live count as a ceiling that may only fall.
- **File split.** Optional and last. Requires changing the service worker to network-first for all same-origin assets in the same commit. See [Why one file](#why-one-file).

Design principles that constrain all of the above are in [Visual direction](#visual-direction) and [Deliberately removed](#deliberately-removed).

### Visual direction

The look is editorial and printed: cream paper, warm black ink, serif for anything that speaks.

- **Ink colours, not screen primaries.** Accents are `--olive`, `--terracotta`, `--gold`, `--blue`. Full-chroma colour is lit and the paper is reflected; the two don't share a light source. Saturated primaries also compete with any photo or artwork a Journey entry might carry later, which should be the strongest colour on screen.
- **`--signal-red` is reserved for destructive actions.** If red is on a routine control, that is a bug.
- **Emphasis is the app's only editorial voice, and it belongs to the record, not the controls.** One loud thing per screen, and it should be a fact about what the person has actually done.
- **Uppercase is for small labels only** (eyebrows, kickers, field labels). Headings and Story names are sentence case. Uppercasing something 35px tall is shouting.
- **State presence, never absence.** No empty slots waiting to be filled, no cadence targets, no shortfall.
- **No decoration that needs `overflow:hidden` to stay in its card.** Offset shadows and rotated shapes escape their parent on mobile.

### Home views

Home has four views: **Stories** (the default), **Steps**, **Timeline** and **Calendar**. The tabs stay as the visible affordance, and a horizontal swipe moves between them in that order. The swipe only fires when the gesture is clearly horizontal, so it never steals a scroll.

Steps is a flat list of every open one-off step across every active Story, newest first, each tagged with the Story it belongs to. No grouping and no counts, so it reads as what's in motion rather than as a backlog.

- **Practices are excluded.** A list of practices not yet marked today is a list of absences, and the app does not show absence.
- **Newest first**, because oldest-first surfaces the stalest thing, which is quietly accusing. There are no due dates and there will not be any.
- **The toggle is not persisted.** The app opens on Stories every launch, not on a list of everything outstanding. Swiping changes how you move between views, not where the app opens.

Timeline is one spine: events **ahead**, then everything **behind**, which is the Journey with past events folded into it.

- **A past event is a Journey entry**, because both are things that happened on a date. Merged at read time, never converted, so nothing is stored twice and the record stays an event: still editable as one, still exportable as one.
- **An event is behind you only once its last day has passed**, so a trip still reads as ahead on its final morning.
- **Nothing counts down and nothing is overdue.** An event is a fact on a date, not a due date. `humanDate()` reads a date relative to today in either direction: Today, Yesterday, 3 days ago, Tomorrow, In 3 days, then a plain date. It never counts down to anything.

Calendar is the month a timeline cannot show: shape, spacing, how full a week is. Same records, laid out rather than listed. Weeks start on Monday, a month takes five rows or six as it needs (an empty trailing row reads as missing content, not as spare space), and tapping a day lists it underneath. A multi-day event appears on every day it covers, not only its first.

### Deliberately removed

Things the app does not have, and should not grow. Each was considered and rejected; treat this as a do-not-build list.

- **Points, or any gamification currency.** The Journey count ("3 steps taken") is the only progress signal, because it is the only honest one. Any future signal must be derived from real activity, never stored or hardcoded.
- **Streaks, badges, and failure states.** No red indicators, no absence markers, no due dates.
- **Goal progress percentages.** Better absent than permanently showing 0%. A real progress model is wanted, but designed deliberately rather than faked.
- **A North Star.** A single global aspiration string, display-only, that nothing else in the app read and that went invisible in daily use.
- **A goal hero panel.** It repeats the leading goal the Goals list shows directly below it. The leading goal is emphasised in the list instead.
- **Rotated or offset decoration on cards.** It escapes its parent on mobile.

### Design decisions

- Main Story card is **blue**.
- "Plan the next step", not "Take a Step". The panel is a queue of upcoming steps, so the label shouldn't imply they're already done. The separate **＋ Log** action is for recording what actually happened.
- Story detail is three sections: **Direction** (goals nested under their chapter, with a trailing "Not in a chapter" block), **Next step**, and **Journey**. Keeping goals inside their chapter makes the relationship visible rather than implied.
- Row actions are quiet **✎ icon buttons**, not "Edit" text, which would compete with the content.
- No section kickers. Three panels all labelled "DIRECTION" say nothing.
- **Deleting a parent never destroys its children.** The rules and the reasoning are in [Deleting things](#deleting-things); they live in one table in the code so the confirmation text and the behaviour cannot drift apart.
- Completed Goals and dormant Chapters stay **visible but quiet** on the Story page rather than disappearing, so there is always a route back to editing them. Never a red failure signal. The pickers and the featured goal use the filtered `goals()`/`chaptersIn()`; the Story page uses `allGoals()`/`allChaptersIn()`.
- Dates use **local** calendar time, never `toISOString()`, which is UTC and stamps the previous day after midnight in a positive-offset timezone.
- **A modal is a list of fields.** `textField()`, `dateField()`, `selectField()` and `modalFooter()` build the markup, `val()` reads a field, `saveAndReturn()` ends the common case. Adding a modal is a short function, not another copy of the same markup. The delete *cascade* stays in `DELETE_RULES` and is never modal configuration; `wireDelete()` is only the wiring, which is identical for every kind.
- No em dashes in UI copy. Commas.

### Known open items

- Practices have no ending. A Practice can only be deleted, not set down or marked as "woven in" (this is just what I do now, stop counting). A `status` of `resting` / `woven` is the intended next move
- A Practice can only be created by adding a Step and converting it in the edit modal. Quick-add always produces a one-off, deliberately, to keep that row a single field
- Converting an existing Step to a Practice brings the record forward but not its history: earlier one-off completions of the same activity stay as separate records and don't gather into the mark count
- Practices appear in the home page "Next steps" teaser alongside one-off steps, undifferentiated
- Completed steps aren't listed anywhere outside the Journey, though they can be reopened from there
- What a Chapter should *be* is still open. In practice they are mostly year-shaped ("2026: becoming a musician") but not always, so no year field has been formalised
- The Story page is macro; there is no focused "what do I do now" view
- `completedAt` is date-only while `createdAt` is a full ISO timestamp
- An `.ics` event with no `DTEND` is written without one, which the spec allows but some importers read as zero length
- `.ics` export emits `TZID` without a matching `VTIMEZONE` component. Google and Apple both accept this; a strict parser may not
- `.ics` is export only. Story cannot read a calendar file back in
- Reminders are stored nowhere, so nothing is exported for them either
- Recurring events cannot skip or move a single occurrence. `EXDATE` and `RECURRENCE-ID` are not supported, so a cancelled week means editing the rule
- Story cannot fire a reminder. An installed PWA cannot schedule a notification for a future date on Android: Notification Triggers never shipped, and web notifications only fire while something is running. A reminder can be stored and exported so Google fires it, but Story itself will never buzz your phone
- "Monthly Issue" (a magazine-style summary of your Journey, with photos) is planned but not started. The data model doesn't yet support attaching photos to Journey entries
