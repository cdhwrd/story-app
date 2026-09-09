/*
  Documented figures, checked against the source they describe.

  These exist because stale documentation is this project's most
  repeated defect, and it never announces itself. The README has, at
  various points, claimed schemaVersion 2 while the code said 3, "37
  selectors" while the count was 43, and a portable ".story" file that
  was never built. Every one was found by a person reading, which is not
  a mechanism.

  A figure that cannot be derived from source does not belong here. The
  2500-line split threshold, for instance, is a decision rather than a
  fact, so nothing asserts it.
*/
const fs = require("fs");
const path = require("path");
const { scriptSource, styleSource } = require("./harness");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const DOCS = ["README.md", "AGENTS.md", "docs/architecture.md", "docs/data-model.md",
              "docs/design.md", "docs/integrations.md", "docs/roadmap.md"];
const allDocs = DOCS.map(read).join("\n");

module.exports = function (t) {
  const js = scriptSource();
  const css = styleSource();

  t.section("the schema version the docs quote");
  const inCode = /^const SCHEMA_VERSION = (\d+)/m.exec(js)[1];
  const quoted = /Current `schemaVersion` is \*\*(\d+)\*\*/.exec(allDocs);
  t.ok("the docs state a schema version", quoted !== null);
  t.ok(`docs say ${quoted && quoted[1]}, code says ${inCode}`, quoted && quoted[1] === inCode);

  /* The migration list must not fall behind the runner either: every
     version up to the current one needs an entry a reader can find. */
  const documented = [...allDocs.matchAll(/\*\*v(\d+)\*\*/g)].map((m) => Number(m[1]));
  for (let v = 1; v <= Number(inCode); v++) {
    t.ok(`v${v} is documented`, documented.includes(v));
  }

  t.section("the vendored library");
  const vendored = fs.readdirSync(root).find((f) => f.startsWith("rrule-") && f.endsWith(".js"));
  t.ok("exactly one rrule file is present", !!vendored);
  t.ok("index.html loads it by that name", read("index.html").includes(`src="${vendored}"`));
  t.ok("the service worker precaches it", read("service-worker.js").includes(`./${vendored}`));
  t.ok("the docs name the same file", allDocs.includes(vendored));
  t.ok(
    "no doc names a different rrule version",
    [...allDocs.matchAll(/rrule-[\d.]+\.min\.js/g)].every((m) => m[0] === vendored)
  );

  /* Size is quoted to justify taking the dependency at all, so it has
     to stay true if the file is ever upgraded. */
  const raw = fs.statSync(path.join(root, vendored)).size;
  const quotedKb = /`rrule-[\d.]+\.min\.js` \((\d+)KB/.exec(allDocs);
  t.ok("the docs quote a size", quotedKb !== null);
  t.ok(
    `docs say ${quotedKb && quotedKb[1]}KB, file is ${Math.round(raw / 1024)}KB`,
    quotedKb && Math.abs(Number(quotedKb[1]) - raw / 1024) < 2
  );

  t.section("figures taken from the stylesheet");
  /* Counted the way conventions.test.js counts them: base layer only,
     media blocks excluded. */
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let base = "", i = 0;
  for (;;) {
    const re = /@media[^{]*\{/g;
    re.lastIndex = i;
    const hit = re.exec(noComments);
    if (!hit) { base += noComments.slice(i); break; }
    base += noComments.slice(i, hit.index);
    let depth = 1, k = re.lastIndex;
    while (depth) { if (noComments[k] === "{") depth++; else if (noComments[k] === "}") depth--; k++; }
    i = k;
  }
  const counts = {};
  for (const rule of base.match(/[^{}]+\{[^{}]*\}/g) || []) {
    for (const sel of rule.slice(0, rule.indexOf("{")).split(",")) {
      const key = sel.trim();
      if (key && !key.startsWith("@")) counts[key] = (counts[key] || 0) + 1;
    }
  }
  const dupes = Object.values(counts).reduce((n, c) => n + (c > 1 ? c - 1 : 0), 0);
  const quotedDupes = /(\d+) selectors have more than one base-layer definition/.exec(allDocs);
  t.ok("the docs quote a duplicate count", quotedDupes !== null);
  t.ok(
    `docs say ${quotedDupes && quotedDupes[1]}, stylesheet has ${dupes}`,
    quotedDupes && Number(quotedDupes[1]) === dupes
  );

  const media = (css.match(/@media[^{]*\{/g) || []).map((m) => m.replace(/\s/g, ""));
  const at = (px) => media.filter((m) => m.includes(`max-width:${px}px`)).length;
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const quoted900 = /(\w+) `@media\(max-width:900px\)` blocks and (\w+) at 560px/.exec(allDocs);
  t.ok("the docs quote breakpoint counts", quoted900 !== null);
  t.ok(`900px: docs say ${quoted900 && quoted900[1]}, found ${at(900)}`, quoted900 && words[quoted900[1]] === at(900));
  t.ok(`560px: docs say ${quoted900 && quoted900[2]}, found ${at(560)}`, quoted900 && words[quoted900[2]] === at(560));

  t.section("names the docs use must exist in the code");
  /* A table of state keys that has drifted from DEFAULT_STATE sends a
     reader looking for a list that is not there. */
  const defaults = /const DEFAULT_STATE = \{([\s\S]*?)\n\};/.exec(js)[1];
  const stateLists = [...defaults.matchAll(/^\s*(\w+):\s*\[\]/gm)].map((m) => m[1]);
  const dataModel = read("docs/data-model.md");
  /* Checked against the table row, not the file. The key appears in
     prose all over this document, so "is it mentioned" passes even when
     the table is wrong. */
  const tableRows = (dataModel.match(/^\|.*\|$/gm) || []).join("\n");
  for (const key of stateLists) {
    t.ok(`the entity table has a row for \`${key}\``, new RegExp(`\\|\\s*\`${key}\`\\s*\\|`).test(tableRows));
  }

  const labels = [...js.matchAll(/label:"([^"]+)"/g)].map((m) => m[1]);
  t.ok("DELETE_RULES labels were found", labels.length >= 5);
  for (const label of labels) {
    t.ok(`the deletion table has a row for ${label}`, new RegExp(`^\\| ${label} \\|`, "m").test(dataModel));
  }

  t.section("the section map in AGENTS.md");
  const markers = [...read("index.html").matchAll(/SECTION: ([\w-]+)/g)].map((m) => m[1]);
  const agents = read("AGENTS.md");
  for (const m of markers) t.ok(`\`SECTION: ${m}\` is listed`, agents.includes(`SECTION: ${m}`));
  const listed = [...agents.matchAll(/`SECTION: ([\w-]+)`/g)].map((m) => m[1]);
  const ghosts = listed.filter((l) => !markers.includes(l));
  t.ok(ghosts.length === 0 ? "no marker is listed that does not exist" : `ghost markers: ${ghosts}`, ghosts.length === 0);

  t.section("the home views the docs name");
  const views = /const HOME_VIEWS=\[([^\]]+)\]/.exec(js)[1].split(",").map((s) => s.replace(/["\s]/g, ""));
  const design = read("docs/design.md");
  t.ok(`the docs say ${views.length} views`, new RegExp(`Home has ${["", "one", "two", "three", "four", "five"][views.length]} views`).test(design));
  for (const v of views) {
    t.ok(`${v} is named`, new RegExp(`\\*\\*${v[0].toUpperCase() + v.slice(1)}\\*\\*`).test(design));
  }

  t.section("constants quoted in prose");
  t.ok("the .ics fold width matches the writer", /if\(used\+n>75\)/.test(js) && allDocs.includes("75 **octets**"));
  t.ok("the backup retention matches the pruner", /all\.slice\(3\)/.test(js) && /last 3/.test(allDocs));
};
