# Working on Story

Standing instructions for anyone, human or agent, changing this repo.
Read this and the README before making changes. The README explains what
Story is and why; this file explains how to work on it.

## Before touching anything

- `git fetch origin` and compare against `origin/main`. Other sessions may
  have pushed. Never trust a cached memory of file contents.
- Read the README's **Known open items**, **Deliberately removed** and
  **Visual direction** sections, so you don't reintroduce something that
  was removed on purpose.

## Finding your way around index.html

Everything is in one file. Grep for these markers rather than scanning:

| Marker | Holds |
|---|---|
| `SECTION: tokens` | CSS custom properties, the palette |
| `SECTION: styles-poster` | The editorial layer over the base styles |
| `SECTION: persistence` | IndexedDB, schema version, migrations, backups |
| `SECTION: derivations` | Pure functions of state. Testable, and tested |
| `SECTION: views` | Render functions |
| `SECTION: modals` | Edit and confirm dialogs |
| `SECTION: backup` | Export, import, restore, Google Drive |

Line numbers go stale; markers don't.

## Tests

```
node tests/run.js
```

No dependencies, no install step, no build. The suite reads `index.html`
directly and extracts named functions from the inline `<script>`, so the
tests exercise the real source rather than a copy.

Rules:

- **Never change persistence, migration or restore code without a test.**
  Data loss has happened once already from an untested assumption.
- **When refactoring for speed or tidiness, keep the old implementation
  in the test** and assert the new one matches it. See
  `tests/selectors.test.js` for the pattern.
- If you add a function to the derivations band, add tests for it. That
  band exists to be testable.

## Pushing

1. The owner pastes a short-lived GitHub token scoped to this repo.
2. Mask the token in any output.
3. Run `node tests/run.js` before committing. CI runs it too, but a red
   main is worse than a slow local check.
4. Commit with a message explaining *why*, push to `main`. Pages
   redeploys in about a minute.
5. Remind the owner to delete the token.

## Code quality rules

These come from things that actually went wrong:

- **Never commit a file that isn't wired up.** A whole JS file was once
  committed with no `<script>` tag referencing it.
- **Edit CSS rules in place.** Don't stack a new layer of overrides on
  old ones. One definition per selector. There is existing debt here
  (see README, Known open items); don't add to it.
- **If a shared class says something the data model no longer supports,
  rename or remove it.** Don't hide it with `display:none`.
- **Contain decorative CSS.** Offset shadows, rotated shapes and
  pseudo-elements need `overflow:hidden` on the parent. This broke the
  mobile layout once.
- **Derive, don't store.** Any number the app shows should be computed
  from real records. No stored counters that can drift.
- **Keep the README accurate** after every change. It is the project's
  source of truth, not decoration.

## Product constraints

Established deliberately. Don't relitigate without asking.

- No streaks, badges, or red "you failed" indicators, anywhere.
- No points or gamification currency. Removed on purpose.
- Show presence, never absence. No empty slots waiting to be filled, no
  cadence targets, no shortfall.
- Real foreign key fields in the data model, not a generic polymorphic
  tag system.
- Local-first. IndexedDB is the source of truth, stored as a single
  document. The app must work fully offline with no account. Drive backup
  is optional infrastructure.
- Keep changes minimal and additive. This is a personal MVP in daily use,
  not a platform. Prefer small correct changes to big rewrites.
- No em dashes in UI copy, use commas.
