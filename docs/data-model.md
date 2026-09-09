# Data model

## Data model

The whole state is a single record in IndexedDB (see [Why one document](architecture.md#why-one-document)). Current `schemaVersion` is **3**.

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

**Events are the one deliberate exception to the vocabulary rule below.** They carry Google Calendar's field names verbatim, `summary` and `description` rather than title and note, so that an export is a mapping and not a translation. The reasoning and its limits are in [Google Calendar alignment](integrations.md#google-calendar-alignment).

Two consequences worth knowing. All-day `end` is **exclusive**, the day after the last day, as Google has it, so a trip on the 25th to the 27th stores `end: 2026-09-28`; nothing a person reads touches `end` directly, it goes through `eventLastDate()`. And times are local wall clock plus an IANA zone, never `toISOString()`.

**Recurrence is expanded at read time and never stored**, the same way mark counts are derived. A birthday is one record, so editing it moves every occurrence. An *occurrence* is `{date, last, rec}`: the record plus the days it actually lands on. Expansion runs through UTC and comes back through `utcDateOf()`, because a repeating event is a wall-clock idea (a birthday is the 16th everywhere) and local time would drift it across a DST boundary. Views expand at most a year either way; a rule can run forever, a view cannot.

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
