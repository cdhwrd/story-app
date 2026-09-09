# AGENTS.md

Story: a single-user, local-first life navigator. No build step, no framework. The app is `index.html` with all styles, markup and script inline, plus one vendored library, `rrule-2.8.1.min.js`, for recurrence.

## Commands

```
node tests/run.js     # the whole suite. No install step.
git fetch origin      # before assuming repo state. Other sessions push here.
```

Deploy is `git push` to `main`; GitHub Pages redeploys in about a minute.

## Before changing anything

`git fetch origin`, compare against `origin/main`, and run the suite. It must be green before you start.

## Done criteria

- `node tests/run.js` passes
- new logic in the derivations band has tests
- README **Current status** and **Known open items** reflect reality
- the owner has been reminded to delete the token

## The suite is the spec

`tests/conventions.test.js` fails the build on duplicate CSS selectors, classes defined but never rendered, classes rendered with no rule, inline styles, functions with no caller, `data-` attributes with no handler, em dashes in UI copy, and the pre-v3 state keys. Those rules are not restated below; run the suite instead of memorising them.

Three ratchets hold a ceiling that may only be lowered. Never raise one to make a change fit.

## Never

- Never change persistence, migration, restore or delete code without writing a test first.
- Never commit a file nothing references.
- Never hide an obsolete class with `display:none`. Remove or rename it. The suite catches an unused class, not a hidden one.
- Never store a number the app can derive from records.
- Never introduce streaks, badges, points, due dates, or red failure states.
- Never reintroduce offset or rotated decoration that needs `overflow:hidden` to stay in its card.
- When a caller violates a function's unstated precondition, fix the function so the precondition is gone rather than patching the call site.

## Why the constraints exist

The app records what happened, never what did not. Most of the rules above follow from that one: no due dates, no streaks, no absence indicators, and ordering that surfaces momentum rather than the stalest item. A choice that looks arbitrary usually follows from it. Nothing here should measure the gap between what was done and what could have been.

## Finding your way around index.html

Grep for the marker. Line numbers go stale.

| Marker | Holds |
|---|---|
| `SECTION: tokens` | CSS custom properties, palette |
| `SECTION: styles-poster` | editorial layer over base styles |
| `SECTION: persistence` | IndexedDB, schema version, migrations, backups |
| `SECTION: derivations` | pure functions of state. Testable, and tested |
| `SECTION: views` | render functions |
| `SECTION: modals` | edit and confirm dialogs |
| `SECTION: backup` | export, import, restore, Google Drive, `.ics` |

## Where to read why

Open only what the task needs.

| Task | Read |
|---|---|
| Deleting, cascades, orphans | [Deleting things](README.md#deleting-things) |
| Steps, practices, marks | [Steps and Practices](README.md#steps-and-practices) |
| Home screen, step lists | [Home views](README.md#home-views) |
| Colour, type, emphasis | [Visual direction](README.md#visual-direction) |
| Schema, fields, ids | [Data model](README.md#data-model) |
| Migrations | [Migrations](README.md#migrations) |
| Tests, harness | [Tests](README.md#tests) |
| Why one file | [Why one file](README.md#why-one-file) |
| What not to rebuild | [Deliberately removed](README.md#deliberately-removed) |
| What to work on | [Current priorities](README.md#current-priorities) |

## Pushing

The owner pastes a short-lived token. Mask it in all output.

```
git push "https://<token>@github.com/cdhwrd/story-app.git" main
```

- The token needs **Contents: read and write**.
- Touching `.github/workflows/` also needs **Workflows: read and write**, or GitHub rejects the whole push, including for a comment change. Leave workflow files alone unless asked.
- `git pull` needs `--no-rebase` here; the repo has no pull strategy configured.

## Scope

Small, correct, additive changes. This is a personal MVP in daily use, not a platform. Prefer fixing one thing well to rewriting a section.
