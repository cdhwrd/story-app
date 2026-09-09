/*
  latest() and activeStories() were rewritten for speed. These tests pin
  their behaviour against the implementations they replaced, so a future
  optimisation cannot quietly change what the home screen shows.

  This is the pattern to copy for any future refactor: keep the old
  implementation in the test, assert the new one matches it.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  global.state = { stories: [], journey: [], steps: [] };
  global.attRank = { max: 0, active: 1, available: 2, background: 3 };

  loadGlobal(["latest", "activeStories"]);

  /* The implementations as they were before the refactor. */
  const oldActs = (id) =>
    state.journey.filter((x) => x.storyId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
  const oldLatest = (id) => oldActs(id)[0]?.date || "";
  const oldActive = () =>
    [...state.stories].filter((x) => x.status === "active")
      .sort((a, b) =>
        attRank[a.attention] - attRank[b.attention] ||
        (oldLatest(b.id) || "").localeCompare(oldLatest(a.id) || ""));

  const atts = ["max", "active", "available", "background"];
  let orderMismatch = 0;
  let latestMismatch = 0;
  let checked = 0;

  for (let run = 0; run < 400; run++) {
    const nq = 1 + Math.floor(Math.random() * 7);
    state.stories = [];
    state.journey = [];
    for (let i = 0; i < nq; i++) {
      state.stories.push({
        id: "q" + i,
        name: "S" + i,
        attention: atts[Math.floor(Math.random() * 4)],
        status: Math.random() < 0.15 ? "paused" : "active"
      });
    }
    const na = Math.floor(Math.random() * 25);
    for (let i = 0; i < na; i++) {
      const d = new Date(2026, 0, 1 + Math.floor(Math.random() * 300));
      state.journey.push({
        id: "a" + i,
        storyId: "q" + Math.floor(Math.random() * nq),
        date: d.toISOString().slice(0, 10)
      });
    }
    for (const q of state.stories) {
      checked++;
      if (latest(q.id) !== oldLatest(q.id)) latestMismatch++;
    }
    const a = activeStories().map((x) => x.id).join(",");
    const b = oldActive().map((x) => x.id).join(",");
    if (a !== b) orderMismatch++;
  }

  t.section("randomised equivalence, 400 generated states");
  t.ok(`latest() identical across ${checked} stories`, latestMismatch === 0);
  t.ok("activeStories() ordering identical every run", orderMismatch === 0);

  t.section("edge cases");
  state.stories = [{ id: "q1", attention: "active", status: "active" }];
  state.journey = [];
  t.ok("no activity returns an empty string", latest("q1") === "");
  t.ok("a story with no activity is still listed", activeStories().length === 1);
  state.stories = [];
  t.ok("no stories returns an empty list", activeStories().length === 0);
  state.stories = [{ id: "q1", attention: "active", status: "paused" }];
  t.ok("paused stories are excluded", activeStories().length === 0);
};
