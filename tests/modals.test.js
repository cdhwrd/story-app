/*
  The modal building blocks.

  Nine modals were nine copies of the same markup, which is why adding a
  tenth (Events) was worth doing something about first. These are pure
  string functions: a modal is now a list of fields and a footer.

  The delete cascade deliberately stays in DELETE_RULES rather than
  becoming modal configuration. wireDelete() is only the wiring, which
  was identical five times over.
*/
const { loadGlobal } = require("./harness");

module.exports = function (t) {
  loadGlobal(["esc", "field", "textField", "dateField", "selectField", "modalFooter"]);

  t.section("a field wraps its label");
  const f = field("Chapter", "<input id='x'>");
  t.ok("carries the field class", f.includes('class="field"'));
  t.ok("carries the label text", f.includes("<label>Chapter</label>"));
  t.ok("keeps the control inside", f.includes("<input id='x'>"));

  t.section("text fields");
  const tf = textField("goalTitle", "Goal", "Finish draft");
  t.ok("has its id", tf.includes('id="goalTitle"'));
  t.ok("carries the value", tf.includes('value="Finish draft"'));
  t.ok("omits placeholder when there is none", !tf.includes("placeholder"));
  t.ok(
    "includes placeholder when given",
    textField("a", "b", "", "e.g. Photography").includes('placeholder="e.g. Photography"')
  );
  t.ok("empty value omits the attribute entirely", !textField("a", "b").includes("value="));

  /* A Story called `Ben & "Jo" <hi>` must not break the modal, and must
     not be able to inject markup into it. */
  t.section("user text is escaped, everywhere it lands");
  const nasty = '"><script>alert(1)</script>';
  t.ok("escaped in a value", !textField("a", "b", nasty).includes("<script>"));
  t.ok("escaped in a placeholder", !textField("a", "b", "", nasty).includes("<script>"));
  t.ok("escaped in a label", !field(nasty, "").includes("<script>"));
  t.ok("escaped in a date value", !dateField("a", "b", nasty).includes("<script>"));
  t.ok(
    "escaped in an option label",
    !selectField("a", "b", [["v", nasty]], "v").includes("<script>")
  );
  t.ok(
    "escaped in an option value",
    !selectField("a", "b", [[nasty, "t"]], "x").includes("<script>")
  );

  t.section("date fields");
  const df = dateField("logDate", "Date", "2026-09-08");
  t.ok("is a date input", df.includes('type="date"'));
  t.ok("carries the date", df.includes('value="2026-09-08"'));

  t.section("select fields");
  const sf = selectField("status", "Status", [["active", "active"], ["dormant", "dormant"]], "dormant");
  t.ok("renders both options", (sf.match(/<option/g) || []).length === 2);
  t.ok("marks the selected one", sf.includes('value="dormant" selected'));
  t.ok("leaves the other unselected", sf.includes('value="active">'));
  t.ok(
    "nothing is selected when the value matches no option",
    !selectField("s", "S", [["a", "a"]], "zzz").includes("selected")
  );
  t.ok(
    "an empty option can be the selected one",
    selectField("s", "S", [["", "No chapter"], ["c1", "One"]], "").includes('value="" selected')
  );
  t.ok("no options renders an empty select", selectField("s", "S", [], "").includes("<select"));

  t.section("the footer");
  const withDelete = modalFooter("saveGoal", "Save", "deleteGoal");
  t.ok("has the save button and its label", withDelete.includes('id="saveGoal"') && withDelete.includes(">Save<"));
  t.ok("always has cancel", withDelete.includes('id="cancelModal"'));
  t.ok("has delete when asked", withDelete.includes('id="deleteGoal"'));

  const noDelete = modalFooter("saveNewStory", "Create story");
  t.ok("omits delete when not asked", !noDelete.includes("danger"));
  t.ok("still has cancel", noDelete.includes('id="cancelModal"'));
  t.ok("still has save", noDelete.includes('id="saveNewStory"'));

  /* Cancel is what closes the modal, and showModal() wires it by id.
     A footer without it strands the user on an unclosable dialog. */
  t.ok("every footer can be dismissed", modalFooter("a", "b").includes("cancelModal"));
};
