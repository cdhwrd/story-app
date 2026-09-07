/*
  Story is a single HTML file with its JavaScript inline, which is a
  deliberate choice (see README, "Why one file"). This harness is the
  price of that choice: it pulls named functions out of the inline
  <script> so Node can test them directly, with no build step and no
  duplication of application code into the tests.

  Tests exercise the real source. If a function is renamed or deleted,
  the harness throws rather than silently testing nothing.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "index.html");

/* The inline script block, as text. */
function scriptSource() {
  const html = fs.readFileSync(APP, "utf8");
  const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("No inline <script> block found in index.html");
  return m[1];
}

/* The <style> block, as text. */
function styleSource() {
  const html = fs.readFileSync(APP, "utf8");
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!m) throw new Error("No <style> block found in index.html");
  return m[1];
}

/*
  Pull one named function out by matching braces from its opening one.

  Known limitation: this counts every brace, so it would mis-slice a
  function containing an unbalanced brace inside a string or comment
  (e.g. a lone "}" in a quoted string). Template literal ${...} is
  balanced and therefore fine. If extraction ever starts returning
  nonsense, this is the first place to look.
*/
function extract(name, src) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error(`Function not found in index.html: ${name}`);
  let i = src.indexOf("{", at);
  let depth = 0;
  for (;; i++) {
    if (i >= src.length) throw new Error(`Unbalanced braces reading: ${name}`);
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(at, i + 1);
}

/*
  Load the named functions. They are evaluated in this context, so any
  application globals they touch (state, save, toast, renderHome, ...)
  resolve to whatever the test has put on `global`. Anything a test
  forgets to stub throws on call rather than passing quietly.
*/
function load(names) {
  const src = scriptSource();
  const body = names.map((n) => extract(n, src)).join("\n");
  return vm.runInThisContext(
    `(function(){\n${body}\nreturn {${names.join(",")}};\n})`
  )();
}

/* Load onto global too, so tests can call them unqualified. */
function loadGlobal(names) {
  const fns = load(names);
  for (const k of Object.keys(fns)) global[k] = fns[k];
  return fns;
}

module.exports = { APP, scriptSource, styleSource, extract, load, loadGlobal };
