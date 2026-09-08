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

/* From a start offset, return source through the end of the first
   balanced bracket group, object or array. Used for top-level const
   literals: lookup tables like DELETE_RULES, and lists like
   STATE_LISTS. Matching only `{` would run an array declaration on
   into whatever declaration came next. */
function extractBraced(src, from, name) {
  const open = ["{", "["]
    .map((c) => ({ c, at: src.indexOf(c, from) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  if (!open) throw new Error(`No object or array literal for: ${name}`);
  const close = open.c === "{" ? "}" : "]";
  let i = open.at;
  let depth = 0;
  for (;; i++) {
    if (i >= src.length) throw new Error(`Unbalanced brackets reading: ${name}`);
    if (src[i] === open.c) depth++;
    else if (src[i] === close && --depth === 0) break;
  }
  return src.slice(from, i + 1) + ";";
}

/*
  Pull one named function out of the source by matching braces.

  Known limitation: braces are counted without parsing, so a function
  containing an unbalanced brace inside a string or comment (a lone "}"
  in quotes) would be mis-sliced. Template literal ${...} is balanced and
  therefore fine, as are destructured parameters. If extraction ever
  returns nonsense, this is the first place to look.
*/
function extract(name, src) {
  let at = src.indexOf("function " + name + "(");
  if (at < 0) {
    /* Not a function. Try a top-level const, so tests can reach lookup
       tables like DELETE_RULES that functions close over. */
    const c = src.search(new RegExp("^const\\s+" + name + "\\s*=", "m"));
    if (c >= 0) return extractBraced(src, c, name);
    throw new Error(`Not found in index.html: ${name}`);
  }

  /* Keep the `async` keyword if there is one. Slicing from "function"
     would drop it and leave `await` inside a non-async function, which
     is a syntax error rather than a quiet failure, but a confusing one. */
  const before = src.slice(Math.max(0, at - 6), at);
  if (before.endsWith("async ")) at -= 6;

  /* Skip the parameter list first. A destructured or defaulted parameter
     (function f(a,{b=1}={}) ...) contains braces, and matching from the
     first brace would slice the parameter list instead of the body. */
  let i = src.indexOf("(", at + 6);
  let parens = 0;
  for (;; i++) {
    if (i >= src.length) throw new Error(`Unbalanced parens reading: ${name}`);
    if (src[i] === "(") parens++;
    else if (src[i] === ")" && --parens === 0) break;
  }

  i = src.indexOf("{", i);
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
