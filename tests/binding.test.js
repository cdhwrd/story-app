/*
  The dead-button bug: markup renders a data- attribute, nobody binds a
  handler to it, and the button silently does nothing. It has happened
  once already (the Steps toggle).

  This does not test behaviour. It tests that the markup and the wiring
  cannot drift apart, which is the failure that is hard to spot by eye
  because the app looks completely fine.

  There are two render roots: bindMain() wires everything inside #main,
  and renderNav() wires its own sidebar. Either is a legitimate home for
  a handler; what matters is that every attribute the app renders is
  bound somewhere.
*/
const { scriptSource, extract } = require("./harness");

module.exports = function (t) {
  const src = scriptSource();

  /* Attributes a binding site selects on. Written as a selector string
     literal, whether passed straight to querySelectorAll or through
     bindMain's `on` helper. */
  const bound = new Set(
    [...src.matchAll(/["'`]\[data-([a-z-]+)\]/g)].map((m) => m[1])
  );

  /* Attributes the markup actually renders. */
  const rendered = new Set(
    [...src.matchAll(/\sdata-([a-z-]+)=/g)].map((m) => m[1])
  );
  /* stepRow writes data-${practice?"mark":"complete"}, which a plain
     scan cannot see. */
  for (const m of src.matchAll(/\sdata-\$\{[^}]*\?"([a-z-]+)":"([a-z-]+)"/g)) {
    rendered.add(m[1]);
    rendered.add(m[2]);
  }

  t.section("every rendered data attribute is wired");
  t.ok("found binding sites", bound.size > 0);
  t.ok("found rendered attributes", rendered.size > 0);

  const unbound = [...rendered].filter((a) => !bound.has(a));
  t.ok(
    unbound.length === 0
      ? "nothing renders as a dead button"
      : `these render with no handler: ${unbound.join(", ")}`,
    unbound.length === 0
  );

  const unused = [...bound].filter((a) => !rendered.has(a));
  t.ok(
    unused.length === 0
      ? "no handler bound to an attribute nothing renders"
      : `wired but never rendered: ${unused.join(", ")}`,
    unused.length === 0
  );

  t.section("bindMain is the single home for #main handlers");
  const bind = extract("bindMain", src);
  const inBindMain = new Set(
    [...bind.matchAll(/\[data-([a-z-]+)\]/g)].map((m) => m[1])
  );
  t.ok("bindMain wires more than one attribute", inBindMain.size > 1);
  t.ok("bindMain does not wire the sidebar", !inBindMain.has("nav"));

  /* Every function bindMain dispatches to must exist. `fn` is its own
     local helper parameter, not an app function. */
  const called = [...bind.matchAll(/=>\s*([a-zA-Z_$][\w$]*)\(/g)]
    .map((m) => m[1])
    .filter((n) => n !== "fn");
  const missing = [...new Set(called)].filter(
    (name) => !new RegExp("function\\s+" + name + "\\b").test(src)
  );
  t.ok(
    missing.length === 0
      ? "every function bindMain dispatches to is defined"
      : `bindMain calls undefined functions: ${missing.join(", ")}`,
    missing.length === 0
  );
};
