# AGENTS.md

Story: a single-user, local-first life navigator. One HTML file, no build step, no framework, no dependencies.

## Commands

```
node tests/run.js          # the whole suite. No install step needed.
git fetch origin           # always, before assuming repo state
```

There is nothing to build and nothing to install. Deploy is `git push` to `main`; GitHub Pages redeploys in about a minute.

## Before changing anything

1. `git fetch origin` and compare with `origin/main`. Other sessions push here.
2. Run `node tests/run.js`. It must be green before you start.
3. Read the README section for what you are touching (table below).

## Done criteria

A change is not finished until all of these are true:

- `node tests/run.js` passes
- new logic in the derivations band has tests
- README **Current status** and **Known open items** reflect reality
- the owner has been reminded to delete the token

## Never

- Never change persistence, migration, restore or delete code without a test.
- Never commit a file nothing references.
- Never add a second definition of a CSS selector. Edit the existing rule.
- Never hide an obsolete class with `display:none`. Remove or rename it.
- Never store a number the app can derive from records.
- Never reintroduce the pre-v3 state keys (`quests`, `subs`, `tasks`, `activities`, `questId`, `subQuestId`, `taskId`). The state uses the UI's words.
- Never introduce streaks, badges, points, due dates, or red failure states.
- Never use an em dash in UI copy. Use a comma.
- Never reintroduce offset or rotated decoration that needs `overflow:hidden` to stay in its card.

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
| `SECTION: backup` | export, import, restore, Google Drive |

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

## Who this is for

The owner uses it daily. It is also built for someone easily overwhelmed and low on motivation. That is why there are no due dates, no streaks, no absence indicators, and why ordering surfaces momentum rather than the stalest item. Design choices that look arbitrary usually follow from this.

## Scope

Small, correct, additive changes. This is a personal MVP in daily use, not a platform. Prefer fixing one thing well to rewriting a section.
