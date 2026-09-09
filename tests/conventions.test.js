/*
  Project rules, as assertions.

  AGENTS.md tells an agent what the conventions are. This file is what
  makes them stick: guidance can be skipped, a red build cannot. Three
  checks are ratchets, holding a ceiling that may only fall, so the
  codebase gets tidier over time without anyone scheduling a cleanup.

  Lowering a ceiling after cleanup is expected and welcome. Raising one
  is the thing to argue about in review.
*/
const fs = require("fs");
const path = require("path");
const { scriptSource, styleSource, APP } = require("./harness");

/* Ceilings. Lower these when you clean up. Do not raise them. */
const MAX_DUPLICATE_SELECTORS = 43;
const MAX_UNUSED_CLASSES = 0;
const MAX_INLINE_STYLES = 13;
const MAX_AGENTS_LINES = 150;

module.exports = function (t) {
  const html = fs.readFileSync(APP, "utf8");
  const js = scriptSource();
  const css = styleSource();
  const root = path.join(__dirname, "..");

  /* --- ids ------------------------------------------------------- */
  t.section("ids are unique");
  const dateNowIds = js.match(/["'`][a-z]-["'`]\s*\+\s*Date\.now\(\)/g) || [];
  t.ok(
    dateNowIds.length === 0
      ? "no id is generated from Date.now()"
      : `Date.now() used for ids at ${dateNowIds.length} sites, use newId()`,
    dateNowIds.length === 0
  );

  /* --- CSS ------------------------------------------------------- */
  t.section("stylesheet does not get messier");

  /* Duplicate selectors in the base layer. Media queries legitimately
     redefine selectors, so they are excluded. */
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let base = "";
  let i = 0;
  for (;;) {
    const m = /@media[^{]*\{/g;
    m.lastIndex = i;
    const hit = m.exec(noComments);
    if (!hit) { base += noComments.slice(i); break; }
    base += noComments.slice(i, hit.index);
    let depth = 1;
    let k = m.lastIndex;
    while (depth) {
      if (noComments[k] === "{") depth++;
      else if (noComments[k] === "}") depth--;
      k++;
    }
    i = k;
  }
  const counts = {};
  for (const rule of base.match(/[^{}]+\{[^{}]*\}/g) || []) {
    const sel = rule.slice(0, rule.indexOf("{"));
    for (const s of sel.split(",")) {
      const key = s.trim();
      if (key && !key.startsWith("@")) counts[key] = (counts[key] || 0) + 1;
    }
  }
  const dupes = Object.values(counts).reduce((n, c) => n + (c > 1 ? c - 1 : 0), 0);
  t.ok(
    `duplicate selector definitions ${dupes} of at most ${MAX_DUPLICATE_SELECTORS}`,
    dupes <= MAX_DUPLICATE_SELECTORS
  );
  if (dupes < MAX_DUPLICATE_SELECTORS) {
    console.log(`      ratchet: lower MAX_DUPLICATE_SELECTORS to ${dupes}`);
  }

  /* A class in the stylesheet that nothing renders. */
  const markup = html.replace(css, "");
  const unused = [...new Set(css.match(/\.([a-zA-Z][\w-]*)/g) || [])]
    .map((c) => c.slice(1))
    .filter((c) => !markup.includes(c));
  t.ok(
    unused.length <= MAX_UNUSED_CLASSES
      ? "no CSS class is defined but never rendered"
      : `unused classes: ${unused.join(", ")}`,
    unused.length <= MAX_UNUSED_CLASSES
  );

  /* The other direction, which is how a decorative pseudo-element got
     loose: a timeline used class="journal", which had no rule at all, so
     the offset dot on .journal-entry escaped its container to the left.
     A class with no rule is either a typo or a missing style, and both
     show up as broken layout rather than as nothing. */
  const rendered = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c && !c.includes("$")) rendered.add(c);
  }
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const undefined_ = [...rendered].filter((c) => !defined.has(c));
  t.ok(
    undefined_.length === 0
      ? "no rendered class is missing a rule"
      : `classes with no rule: ${undefined_.join(", ")}`,
    undefined_.length === 0
  );

  /* A tall modal used to overflow a fixed, centred flex container with
     nothing scrollable, which put the save button off-screen and made
     the longest form in the app impossible to submit. Invisible in any
     test that only looks at markup, so it is asserted on the rules. */
  t.ok("the modal caps its height", /\.modal\{[^}]*max-height/.test(css.replace(/\s+/g, "")));
  t.ok("and its body scrolls", /#modalBody\{[^}]*overflow-y:auto/.test(css.replace(/\s+/g, "")));

  /* Inline styles belong in the stylesheet. The survivors are modal
     bodies and one display toggle. */
  const inline = (html.match(/style="/g) || []).length;
  t.ok(
    `inline style attributes ${inline} of at most ${MAX_INLINE_STYLES}`,
    inline <= MAX_INLINE_STYLES
  );
  if (inline < MAX_INLINE_STYLES) {
    console.log(`      ratchet: lower MAX_INLINE_STYLES to ${inline}`);
  }

  /* --- UI copy --------------------------------------------------- */
  t.section("UI copy follows the product constraints");

  /* Only string literals, so the rules can be discussed in comments and
     documentation without failing their own check. */
  const stripped = js
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const literals = (stripped.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) || []).join("\n");

  const banned = ["streak", "overdue", "you failed", "behind schedule", "past due"];
  const found = banned.filter((w) => new RegExp(w, "i").test(literals));
  t.ok(
    found.length === 0
      ? "no failure or deadline language in UI strings"
      : `banned words in UI strings: ${found.join(", ")}`,
    found.length === 0
  );

  const emDash = literals.includes("\u2014");
  t.ok(emDash ? "em dash found in a UI string, use a comma" : "no em dashes in UI copy", !emDash);

  /* --- vocabulary -------------------------------------------------- */
  t.section("the state speaks the UI's words");

  /* The state used to say quests, subs, tasks and activities while the
     UI said Story, Chapter, Step and Journey, and the README carried a
     table so readers could hold both. v3 renamed them. This is what
     stops the old words creeping back in one record at a time.

     The migration is the one place both vocabularies belong: naming the
     old keys is its entire job. It is cut out before the check. */
  const migStart = js.indexOf("const MIGRATIONS={");
  const migEnd = js.indexOf("\n};", migStart) + 3;
  const outsideMigrations = js.slice(0, migStart) + js.slice(migEnd);
  const legacy = /\bquests\b|\bsubs\b|\btasks\b|\bactivities\b|\bquestId\b|\bsubQuestId\b|\btaskId\b/g;

  /* PRE_V3_LISTS names them too, so an export made before the rename
     still restores. One line, and it points at the migration. */
  const withoutShim = outsideMigrations.replace(/const PRE_V3_LISTS=\{[^}]*\};?/, "");
  const stale = [...new Set(withoutShim.match(legacy) || [])];
  t.ok(
    stale.length === 0
      ? "no pre-v3 state key outside the migration"
      : `pre-v3 state keys are back: ${stale.join(", ")}`,
    stale.length === 0
  );

  /* --- agent docs ------------------------------------------------ */
  t.section("agent instructions stay short and accurate");

  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const agentLines = agents.trim().split("\n").length;
  t.ok(
    `AGENTS.md is ${agentLines} lines, at most ${MAX_AGENTS_LINES}`,
    agentLines <= MAX_AGENTS_LINES
  );

  const claude = fs.existsSync(path.join(root, "CLAUDE.md"))
    ? fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8")
    : "";
  t.ok("CLAUDE.md imports AGENTS.md rather than duplicating it", claude.includes("@AGENTS.md"));
  t.ok("CLAUDE.md stays thin", claude.trim().split("\n").length <= 10);

  /* The router rots silently if the README is reorganised. Every
     README anchor AGENTS.md links to must resolve to a real heading. */
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const slugs = new Set(
    (readme.match(/^#{2,4}\s+.+$/gm) || []).map((h) =>
      h.replace(/^#+\s+/, "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
    )
  );
  const links = [...agents.matchAll(/README\.md#([\w-]+)/g)].map((m) => m[1]);
  const broken = links.filter((l) => !slugs.has(l));
  t.ok("AGENTS.md routes to README sections", links.length > 0);
  t.ok(
    broken.length === 0
      ? `all ${links.length} README links resolve`
      : `broken README links in AGENTS.md: ${broken.join(", ")}`,
    broken.length === 0
  );
};
