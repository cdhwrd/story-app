/*
  Runs every *.test.js in this folder. No dependencies: `node tests/run.js`
  is the whole command, on any machine with Node installed.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { scriptSource, styleSource } = require("./harness");

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition) {
  if (condition) {
    passed++;
    console.log("    pass  " + name);
  } else {
    failed++;
    failures.push(name);
    console.log("    FAIL  " + name);
  }
}

function section(title) {
  console.log("  " + title);
}

const t = { ok, section };

/*
  Before anything else: does the app even parse? This replaces running
  `node --check` on an extracted copy, and catches the case where a bad
  edit makes every other test fail for a confusing reason.
*/
console.log("\nindex.html parses");
try {
  new vm.Script(scriptSource());
  ok("inline script is valid JavaScript", true);
} catch (e) {
  ok("inline script is valid JavaScript: " + e.message, false);
}
const css = styleSource();
ok(
  "style block braces balance",
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length
);

const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

/* Test modules may be async (anything touching applyDelete is, because a
   Story deletion writes a backup first), so each one is awaited. */
(async () => {
  for (const f of files) {
    console.log("\n" + f.replace(".test.js", ""));
    try {
      await require(path.join(__dirname, f))(t);
    } catch (e) {
      /* Usually means a function was renamed or removed in index.html and
         the harness can no longer find it. Report it and keep going, so
         one broken file does not hide the state of the others. */
      ok(`${f} threw: ${e.message}`, false);
    }
  }

  console.log(
    `\n${passed} passed, ${failed} failed, across ${files.length} files`
  );
  if (failed) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  " + f);
  }
  process.exit(failed ? 1 : 0);
})();
