# Architecture

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

`tests/conventions.test.js` holds the project rules as assertions: three ratchets (duplicate selectors, unused classes, inline styles) whose ceilings may only be lowered, a ban on failure and deadline language in UI copy, a guard on the state vocabulary, and four correspondence checks. AGENTS.md names only the rules this file cannot enforce.

The correspondence checks exist because the commonest defect here is not a wrong function but a stale relationship: a function whose last caller went away, a CSS class whose rule never existed, a rule nothing renders, a `data-` attribute nothing listens for. Each is invisible reading either side alone and mechanical to check across both. Every guard is verified to fail on a real example before being trusted.

One correspondence is **not** viable, recorded so it is not attempted twice: `id` against `getElementById`. Ids are built from template arguments (`id="${saveId}"`), which yields 16 false positives.

A seventh check covers the documents themselves: every relative link in the README, AGENTS.md and `docs/` must point at a file that exists and, where it names one, a heading that exists.

`tests/persistence.test.js` covers the migration runner, the shape checks, and the import path. Nothing in the persistence band changes without a test.

`tests/modals.test.js` covers the modal building blocks, `tests/events.test.js` the event derivations, with particular attention to the exclusive all-day end, and `tests/ics.test.js` the calendar export by round trip.

The **derivations** band is where testable logic belongs: pure functions that take state and return data. Anything deciding what is shown, in what order, or what a count is goes there rather than inside a renderer. Renderers turn data into HTML and nothing more.

When refactoring for speed or tidiness, keep the old implementation in the test and assert the new one matches it. `tests/selectors.test.js` is the pattern.

### Why one document

The whole state is one IndexedDB record rather than a store per entity. Every view reads across all five lists, writes are always whole-state, and the export format is the same object. Splitting it would buy partial reads the app never makes, and cost atomicity it depends on.

---

## How the pieces fit

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
