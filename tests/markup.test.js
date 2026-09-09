/*
  Markup helpers. stepRow() is the important one: it now owns the data-
  attributes that openStory and renderHome bind their click handlers to,
  so a change here silently breaks every step button in the app. These
  tests pin the contract between the markup and the wiring.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  global.state = { steps: [], journey: [], goals: [], chapters: [] };
  loadGlobal(["esc", "localDate", "todayLocal", "plural", "emptyState", "stepRow"]);

  t.section("plural");
  t.ok("singular has no s", plural(1, "step") === "1 step");
  t.ok("zero is plural", plural(0, "step") === "0 steps");
  t.ok("many is plural", plural(4, "mark") === "4 marks");

  t.section("emptyState");
  const basic = emptyState("Nothing here.", "Add something.");
  t.ok("carries the shared class", basic.includes('class="step-empty"'));
  t.ok("no page modifier by default", !basic.includes("page-empty"));
  t.ok("page variant adds the modifier", emptyState("a", "b", { page: true }).includes("page-empty"));
  t.ok("no inline styles", !basic.includes("style="));
  t.ok("escapes its content", emptyState("<script>", "x").includes("&lt;script&gt;"));
  t.ok("extra markup is appended", emptyState("a", "b", { extra: "<button id='z'></button>" }).includes("id='z'"));

  t.section("stepRow, one-off step");
  const once = stepRow({ id: "t1", title: "Book dentist" }, { meta: "A step in this Story" });
  t.ok("binds to completeStep", once.includes('data-complete="t1"'));
  t.ok("never binds to mark", !once.includes("data-mark"));
  t.ok("no practice class", !once.includes("step practice"));
  t.ok("no practice tag", !once.includes("practice-tag"));
  t.ok("shows the edit affordance", once.includes('data-edit-step="t1"'));
  t.ok("renders the meta line", once.includes("A step in this Story"));

  t.section("stepRow, practice");
  const prac = stepRow(
    { id: "t2", title: "Write 200 words", mode: "practice", anchor: "after coffee" },
    { meta: "4 marks" }
  );
  t.ok("binds to markPractice", prac.includes('data-mark="t2"'));
  t.ok("never binds to complete", !prac.includes("data-complete"));
  t.ok("carries the practice class", prac.includes('class="step practice"'));
  t.ok("shows the practice tag", prac.includes("practice-tag"));
  t.ok("shows the anchor", prac.includes("after coffee"));
  t.ok("not marked today by default", !prac.includes("marked"));

  t.section("stepRow, practice marked today");
  const markedToday = stepRow(
    { id: "t3", title: "x", mode: "practice", lastMarkedAt: todayLocal() },
    {}
  );
  t.ok("gets the marked class", markedToday.includes("step-trigger marked"));

  t.section("stepRow, home list variant");
  const flat = stepRow({ id: "t4", title: "x" }, { meta: "✦ Writing", edit: false });
  t.ok("omits the edit button", !flat.includes("data-edit-step"));
  t.ok("still completable", flat.includes('data-complete="t4"'));
  t.ok("shows the story tag as meta", flat.includes("✦ Writing"));

  t.section("stepRow escapes user content");
  const nasty = stepRow({ id: "t5", title: '<img src=x onerror="alert(1)">' }, {});
  t.ok("title is escaped", !nasty.includes("<img") && nasty.includes("&lt;img"));
  t.ok("anchor is escaped", stepRow({ id: "t6", title: "a", mode: "practice", anchor: "<b>" }, {}).includes("&lt;b&gt;"));

  t.section("meta is optional");
  t.ok("no empty meta div when unset", !stepRow({ id: "t7", title: "a" }, {}).includes('class="step-meta"'));
};
