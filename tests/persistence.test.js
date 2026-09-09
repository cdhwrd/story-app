/*
  The first tests the persistence band has had. v1 and v2 both shipped
  uncovered, which is the reason this file exists before v3 does.

  v3 renames the state keys to the words the UI has used for a long time
  (Story, Chapter, Step, Journey), retiring the translation table that
  every reader of this codebase has had to hold in their head.

  It is DORMANT on purpose. SCHEMA_VERSION is still 2, so the runner
  never reaches MIGRATIONS[3]. Migrating live data to the new shape
  while the rest of the app still reads the old one would empty the app
  for as long as the two commits are apart. The bump ships with the
  rename, and the assertion at the bottom of this file is what holds
  that promise until then.
*/
const { load, scriptSource } = require("./harness");

const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The value in the file, which no harness helper can reach: it is a
   bare `const NAME = 2`, not a function and not an object literal. */
function schemaVersionInSource() {
  const m = scriptSource().match(/^const\s+SCHEMA_VERSION\s*=\s*(\d+)/m);
  if (!m) throw new Error("SCHEMA_VERSION not found in index.html");
  return Number(m[1]);
}

/* A v2 state with one of everything, including the awkward cases: a
   Journey entry typed by hand (no step behind it), a Goal filed under
   no Chapter, and a Practice carrying its own fields. */
function v2State() {
  return {
    schemaVersion: 2,
    mainStoryId: "q1",
    exportedAt: "2026-01-02T03:04:05.000Z",
    driveEnabled: true,
    driveBackupAt: "2026-01-02T03:04:05.000Z",
    quests: [
      { id: "q1", name: "Writing", icon: "✎", attention: "main", status: "active", createdAt: "2025-01-01T00:00:00.000Z" }
    ],
    subs: [
      { id: "s1", questId: "q1", title: "The novel", status: "active", createdAt: "2025-01-02T00:00:00.000Z" }
    ],
    goals: [
      { id: "g1", questId: "q1", subQuestId: "s1", title: "Finish draft", detail: "By spring", status: "open", createdAt: "2025-01-03T00:00:00.000Z" },
      { id: "g2", questId: "q1", subQuestId: null, title: "Unfiled goal", detail: "", status: "open", createdAt: "2025-01-04T00:00:00.000Z" }
    ],
    tasks: [
      { id: "t1", questId: "q1", goalId: "g1", title: "Write 500 words", status: "open", mode: "once", createdAt: "2025-01-05T00:00:00.000Z" },
      { id: "t2", questId: "q1", goalId: null, title: "Morning pages", status: "open", mode: "practice", anchor: "after coffee", lastMarkedAt: "2025-02-01", createdAt: "2025-01-06T00:00:00.000Z" },
      { id: "t3", questId: "q1", goalId: "g1", title: "Done already", status: "complete", completedAt: "2025-02-02", createdAt: "2025-01-07T00:00:00.000Z" }
    ],
    activities: [
      { id: "a1", questId: "q1", taskId: "t2", kind: "practice", note: "Morning pages", date: "2025-02-01" },
      { id: "a2", questId: "q1", taskId: null, note: "Typed straight into the Journey", date: "2025-02-03" }
    ]
  };
}

module.exports = async function (t) {
  /* Set up before loading: DEFAULT_STATE reads SCHEMA_VERSION as it is
     evaluated, and migrate() writes a pre-change backup through the
     IndexedDB layer. The backup is asserted below; here it just must
     not touch a real database. The version comes from the file rather
     than a literal, so the suite cannot drift from the source. */
  let backups = [];
  global.writeBackup = async (snapshot, reason) => { backups.push({ snapshot, reason }); };
  global.SCHEMA_VERSION = schemaVersionInSource();

  /* One load, so these resolve each other: validateImport and
     isCurrentShape both read REQUIRED_LISTS, and separate load() calls
     are separate scopes. */
  const { migrate, MIGRATIONS, withDefaultLists, DEFAULT_STATE, REQUIRED_LISTS,
          validateImport, isCurrentShape, restoreSummary } =
    load(["migrate", "MIGRATIONS", "withDefaultLists", "DEFAULT_STATE", "REQUIRED_LISTS",
          "PRE_V3_LISTS", "validateImport", "isCurrentShape", "restoreSummary"]);

  const v3 = MIGRATIONS[3];

  /* --- top-level lists -------------------------------------------- */
  t.section("v3 renames the state keys to the UI's words");
  const s = v3(v2State());

  t.ok("quests becomes stories", Array.isArray(s.stories) && s.stories.length === 1);
  t.ok("subs becomes chapters", Array.isArray(s.chapters) && s.chapters.length === 1);
  t.ok("tasks becomes steps", Array.isArray(s.steps) && s.steps.length === 3);
  t.ok("activities becomes journey", Array.isArray(s.journey) && s.journey.length === 2);
  t.ok("goals keeps its name", Array.isArray(s.goals) && s.goals.length === 2);

  t.ok("no quests key survives", !("quests" in s));
  t.ok("no subs key survives", !("subs" in s));
  t.ok("no tasks key survives", !("tasks" in s));
  t.ok("no activities key survives", !("activities" in s));

  /* --- foreign keys ------------------------------------------------ */
  t.section("every foreign key is renamed, on every record type");
  t.ok("chapter.questId becomes storyId", s.chapters[0].storyId === "q1" && !("questId" in s.chapters[0]));
  t.ok("goal.questId becomes storyId", s.goals[0].storyId === "q1" && !("questId" in s.goals[0]));
  t.ok("goal.subQuestId becomes chapterId", s.goals[0].chapterId === "s1" && !("subQuestId" in s.goals[0]));
  t.ok("step.questId becomes storyId", s.steps[0].storyId === "q1" && !("questId" in s.steps[0]));
  t.ok("step.goalId is left alone", s.steps[0].goalId === "g1");
  t.ok("journey.questId becomes storyId", s.journey[0].storyId === "q1" && !("questId" in s.journey[0]));
  t.ok("journey.taskId becomes stepId", s.journey[0].stepId === "t2" && !("taskId" in s.journey[0]));

  /* A goal that belongs to no chapter, and a Journey entry typed by
     hand, both hold null rather than nothing. Copying on truthiness
     instead of presence would silently drop the key and change what
     the record means. */
  t.section("null means unfiled, and has to survive as null");
  t.ok("goal.chapterId is null, not missing", s.goals[1].chapterId === null && "chapterId" in s.goals[1]);
  t.ok("journey.stepId is null, not missing", s.journey[1].stepId === null && "stepId" in s.journey[1]);

  /* A Step reaches its Chapter through its Goal and has no chapter
     field of its own, but a few old records still carry the legacy one,
     always null. Renaming it would produce a step.chapterId that looks
     exactly like the live field on a Goal. */
  t.section("the vestigial chapter field on a step is dropped, not renamed");
  const vestigial = v2State();
  vestigial.tasks[0].subQuestId = null;
  const cleaned = v3(vestigial);
  t.ok("the old field is gone from the step", !("subQuestId" in cleaned.steps[0]));
  t.ok("and it was not renamed onto the step", !("chapterId" in cleaned.steps[0]));
  t.ok("the goal keeps its real chapterId", cleaned.goals[0].chapterId === "s1");
  t.ok("the step keeps its goalId", cleaned.steps[0].goalId === "g1");

  /* --- everything else -------------------------------------------- */
  t.section("nothing the rename does not own is touched");
  const before = v2State();
  t.ok("mainStoryId survives", s.mainStoryId === before.mainStoryId);
  t.ok("exportedAt survives", s.exportedAt === before.exportedAt);
  t.ok("driveEnabled survives", s.driveEnabled === true);
  t.ok("driveBackupAt survives", s.driveBackupAt === before.driveBackupAt);

  t.ok("story fields survive", same(s.stories[0], before.quests[0]));
  t.ok("goal detail and status survive", s.goals[0].detail === "By spring" && s.goals[0].status === "open");
  t.ok(
    "practice fields survive",
    s.steps[1].mode === "practice" && s.steps[1].anchor === "after coffee" && s.steps[1].lastMarkedAt === "2025-02-01"
  );
  t.ok("completedAt survives", s.steps[2].completedAt === "2025-02-02");
  t.ok("journey kind, note and date survive", s.journey[0].kind === "practice" && s.journey[0].note === "Morning pages" && s.journey[0].date === "2025-02-01");

  /* An unrecognised key is somebody else's data, or a field this
     version has not heard of yet. Dropping it would be a quiet loss. */
  const extra = v2State();
  extra.somethingNew = { keep: "me" };
  extra.quests[0].futureField = 42;
  const withExtra = v3(extra);
  t.ok("an unknown top-level key survives", same(withExtra.somethingNew, { keep: "me" }));
  t.ok("an unknown record field survives", withExtra.stories[0].futureField === 42);

  /* --- idempotency -------------------------------------------------- */
  t.section("running it twice changes nothing");
  const once = v3(v2State());
  const twice = v3(v3(v2State()));
  t.ok("second pass is a no-op", same(once, twice));

  /* Already-new data arriving from somewhere else must pass through
     untouched rather than having its keys deleted. */
  const alreadyNew = v3(clone(once));
  t.ok("a v3-shaped state survives a v3 pass", same(alreadyNew, once));

  /* --- degenerate inputs -------------------------------------------- */
  t.section("empty and missing shapes do not throw");
  let threw = null;
  try { v3({}); } catch (e) { threw = e; }
  t.ok("an empty object migrates without throwing", threw === null);

  const empty = v3({ schemaVersion: 2, quests: [], subs: [], goals: [], tasks: [], activities: [] });
  t.ok("empty lists come through as empty lists", empty.stories.length === 0 && empty.journey.length === 0);
  t.ok("empty lists still exist as arrays", Array.isArray(empty.chapters) && Array.isArray(empty.steps));

  const partial = v3({ schemaVersion: 2, quests: [{ id: "q1", name: "Only this" }] });
  t.ok("a state missing whole lists still renames what it has", partial.stories[0].name === "Only this");

  /* --- the runner, end to end --------------------------------------- */
  /* The oldest state that can still turn up carries no schemaVersion at
     all: that is what the one-time localStorage migration hands over.
     A state stamped 1 has already had v1 applied, so the runner starts
     it at v2 and the points stripping below would never run. */
  t.section("the whole chain, an unversioned state to v3");
  const oldest = v2State();
  delete oldest.schemaVersion;
  oldest.goals[0].target = "By spring";     // v2 renames this to detail
  delete oldest.goals[0].detail;
  oldest.tasks[0].points = 3;               // v1 strips these
  oldest.activities[0].points = 1;
  oldest.goals[0].progress = 40;

  backups = [];
  const done = await migrate(oldest);

  t.ok("lands on the current schema version", done.schemaVersion === 3);
  t.ok("v1 stripped the step points", !("points" in done.steps[0]));
  t.ok("v1 stripped the journey points", !("points" in done.journey[0]));
  t.ok("v1 stripped the goal progress", !("progress" in done.goals[0]));
  t.ok("v2 carried target across to detail", done.goals[0].detail === "By spring" && !("target" in done.goals[0]));
  t.ok("v3 renamed the keys", Array.isArray(done.stories) && !("quests" in done));
  t.ok("v3 renamed the foreign keys", done.journey[0].storyId === "q1");

  /* Each stamp means "everything up to here has run". */
  t.section("a version stamp is a starting point, not a suggestion");
  const stamped = v2State();
  stamped.schemaVersion = 1;
  stamped.tasks[0].points = 3;
  const fromV1 = await migrate(stamped);
  t.ok("a v1 state is not put through v1 again", fromV1.steps[0].points === 3);
  t.ok("but v2 and v3 still run", fromV1.schemaVersion === 3 && Array.isArray(fromV1.stories));

  t.section("a destructive step writes a backup first");
  backups = [];
  const forBackup = v2State();
  delete forBackup.schemaVersion;
  await migrate(forBackup);
  t.ok("exactly one pre-migration backup was written", backups.length === 1);
  t.ok("it names the version it came from", backups[0].reason === "pre-migration v0");
  t.ok("it holds the old shape, not the new one", Array.isArray(backups[0].snapshot.quests));

  backups = [];
  const current = await migrate(clone(done));
  t.ok("re-migrating an up-to-date state is a no-op", same(current, done));
  t.ok("and writes no backup", backups.length === 0);

  /* --- the import path ------------------------------------------------ */
  /* The ordering trap: validateImport runs BEFORE migrate. Checked for
     the new key names only, it would reject every export made before v3
     with "missing its stories list", and the migration that would have
     fixed the file never gets to run. */
  t.section("an export made before v3 still restores");
  t.ok("a pre-v3 export passes validation", validateImport(v2State()) === null);
  t.ok("a v3 export passes validation", validateImport(once) === null);
  t.ok("junk is rejected", typeof validateImport(null) === "string");
  t.ok("a text file is rejected", typeof validateImport("not an export") === "string");

  const missing = v2State();
  delete missing.tasks;
  t.ok("a file missing a list is rejected", typeof validateImport(missing) === "string");
  t.ok("and the message names the list in today's words", validateImport(missing).includes("steps"));

  t.section("the shape check knows old from new");
  t.ok("a pre-v3 state is not the current shape", isCurrentShape(v2State()) === false);
  t.ok("a migrated state is", isCurrentShape(once) === true);
  t.ok("junk is not", isCurrentShape(null) === false);

  /* The confirmation names what is about to be replaced, and is shown
     before migrate() has run, so it has to read either shape. */
  t.section("the restore confirmation counts either shape");
  t.ok("counts a pre-v3 file", restoreSummary(v2State()) === "1 Story, 2 Journey entries");
  t.ok("counts a v3 file the same way", restoreSummary(once) === "1 Story, 2 Journey entries");
  t.ok(
    "singular reads correctly",
    restoreSummary({ stories: [{}], journey: [{}] }) === "1 Story, 1 Journey entry"
  );
  t.ok(
    "an empty export does not throw",
    restoreSummary({ stories: [], journey: [] }) === "0 Stories, 0 Journey entries"
  );

  /* --- room for a list that does not exist yet -------------------------- */
  /* Events are next, and adding a list should not cost a migration or
     break older files. DEFAULT_STATE is the runtime shape and is
     backfilled; REQUIRED_LISTS is what makes a file a Story export and
     must not grow, or every export written before the new list would be
     rejected. */
  t.section("a list added later costs no migration");

  /* DEFAULT_STATE is the runtime shape and grows. REQUIRED_LISTS is
     what makes a state a Story and must not. */
  t.ok(
    "REQUIRED_LISTS stays at the five that define an export",
    JSON.stringify(REQUIRED_LISTS) ===
      JSON.stringify(["stories", "chapters", "goals", "steps", "journey"])
  );
  /* `once` is a migrated v2 state, so it predates the events list and
     gaining one is the backfill working. A state that already has every
     list must come through untouched. */
  const complete = { ...clone(once), events: [] };
  t.ok("it is a no-op on a complete state", same(withDefaultLists(clone(complete)), complete));
  t.ok("an older state gains the newer list", Array.isArray(withDefaultLists(clone(once)).events));
  t.ok(
    "a file without a later list still validates",
    validateImport({ stories: [], chapters: [], goals: [], steps: [], journey: [] }) === null
  );

  /* migrate() must backfill even when there is no version work to do,
     or a state already at the current version never gains the list. */
  backups = [];
  const upToDate = await migrate({ schemaVersion: 3, stories: [], chapters: [], goals: [], steps: [], journey: [] });
  t.ok("migrating an up-to-date state writes no backup", backups.length === 0);
  t.ok("and leaves its lists alone", upToDate.stories.length === 0);

  /* The backfill must never invent a REQUIRED list.

     A file carrying pre-v3 key names but stamped at the current version
     (hand-edited, half-converted, or written by a later bug) does not
     enter the migration loop, because its version already looks current.
     If the backfill supplied the missing `stories` and `journey`, the
     result would read as a valid, empty Story and be written straight
     over real data on restore, with the confirmation still promising
     the counts it read from the old keys. */
  t.section("a state that failed to convert must not look like an empty one");
  const stampedWrong = {
    schemaVersion: 3,
    quests: [{ id: "q1", name: "Ten years of Writing" }],
    subs: [], goals: [], tasks: [],
    activities: [{ id: "a1", questId: "q1", note: "years of entries", date: "2026-01-01" }]
  };
  const notConverted = await migrate(clone(stampedWrong));
  t.ok("stories is left missing, not invented", notConverted.stories === undefined);
  t.ok("journey is left missing, not invented", notConverted.journey === undefined);
  t.ok("so the shape check rejects it", isCurrentShape(notConverted) === false);
  t.ok("the original data is still there to recover", notConverted.quests[0].name === "Ten years of Writing");

  /* --- activation ------------------------------------------------------ */
  t.section("v3 is live");
  t.ok("MIGRATIONS[3] exists", typeof MIGRATIONS[3] === "function");
  t.ok(
    "SCHEMA_VERSION is 3, so stored data is migrated on load",
    schemaVersionInSource() === 3
  );
};
