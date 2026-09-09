# Design

### Visual direction

The look is editorial and printed: cream paper, warm black ink, serif for anything that speaks.

- **Ink colours, not screen primaries.** Accents are `--olive`, `--terracotta`, `--gold`, `--blue`. Full-chroma colour is lit and the paper is reflected; the two don't share a light source. Saturated primaries also compete with any photo or artwork a Journey entry might carry later, which should be the strongest colour on screen.
- **`--signal-red` is reserved for destructive actions.** If red is on a routine control, that is a bug.
- **Emphasis is the app's only editorial voice, and it belongs to the record, not the controls.** One loud thing per screen, and it should be a fact about what the person has actually done.
- **Uppercase is for small labels only** (eyebrows, kickers, field labels). Headings and Story names are sentence case. Uppercasing something 35px tall is shouting.
- **State presence, never absence.** No empty slots waiting to be filled, no cadence targets, no shortfall.
- **No decoration that needs `overflow:hidden` to stay in its card.** Offset shadows and rotated shapes escape their parent on mobile.
- **A dialog must always be dismissable and submittable.** The modal caps its height and scrolls its body; a fixed, centred flex container silently puts the footer off-screen once the content is tall enough, and a form you cannot submit looks like a broken app rather than a layout bug.

### Home views

Home has four views: **Stories** (the default), **Steps**, **Timeline** and **Calendar**. The tabs stay as the visible affordance, and a horizontal swipe moves between them in that order. The swipe only fires when the gesture is clearly horizontal, so it never steals a scroll.

Steps is a flat list of every open one-off step across every active Story, newest first, each tagged with the Story it belongs to. No grouping and no counts, so it reads as what's in motion rather than as a backlog.

- **Practices are excluded.** A list of practices not yet marked today is a list of absences, and the app does not show absence.
- **Newest first**, because oldest-first surfaces the stalest thing, which is quietly accusing. There are no due dates and there will not be any.
- **The toggle is not persisted.** The app opens on Stories every launch, not on a list of everything outstanding. Swiping changes how you move between views, not where the app opens.

Timeline is one spine: events **ahead**, then everything **behind**, which is the Journey with past events folded into it.

- **A past event is a Journey entry**, because both are things that happened on a date. Merged at read time, never converted, so nothing is stored twice and the record stays an event: still editable as one, still exportable as one.
- **An event is behind you only once its last day has passed**, so a trip still reads as ahead on its final morning.
- **Nothing counts down and nothing is overdue.** An event is a fact on a date, not a due date. `humanDate()` reads a date relative to today in either direction: Today, Yesterday, 3 days ago, Tomorrow, In 3 days, then a plain date. It never counts down to anything.

Calendar is the month a timeline cannot show: shape, spacing, how full a week is. Same records, laid out rather than listed. Weeks start on Monday, a month takes five rows or six as it needs (an empty trailing row reads as missing content, not as spare space), and tapping a day lists it underneath. A multi-day event appears on every day it covers, not only its first.

### Deliberately removed

Things the app does not have, and should not grow. Each was considered and rejected; treat this as a do-not-build list.

- **Points, or any gamification currency.** The Journey count ("3 steps taken") is the only progress signal, because it is the only honest one. Any future signal must be derived from real activity, never stored or hardcoded.
- **Streaks, badges, and failure states.** No red indicators, no absence markers, no due dates.
- **Goal progress percentages.** Better absent than permanently showing 0%. A real progress model is wanted, but designed deliberately rather than faked.
- **A North Star.** A single global aspiration string, display-only, that nothing else in the app read and that went invisible in daily use.
- **A goal hero panel.** It repeats the leading goal the Goals list shows directly below it. The leading goal is emphasised in the list instead.
- **Rotated or offset decoration on cards.** It escapes its parent on mobile.

### Design decisions

- Main Story card is **blue**.
- "Plan the next step", not "Take a Step". The panel is a queue of upcoming steps, so the label shouldn't imply they're already done. The separate **＋ Log** action is for recording what actually happened.
- Story detail is three sections: **Direction** (goals nested under their chapter, with a trailing "Not in a chapter" block), **Next step**, and **Journey**. Keeping goals inside their chapter makes the relationship visible rather than implied.
- Row actions are quiet **✎ icon buttons**, not "Edit" text, which would compete with the content.
- No section kickers. Three panels all labelled "DIRECTION" say nothing.
- **Deleting a parent never destroys its children.** The rules and the reasoning are in [Deleting things](data-model.md#deleting-things); they live in one table in the code so the confirmation text and the behaviour cannot drift apart.
- Completed Goals and dormant Chapters stay **visible but quiet** on the Story page rather than disappearing, so there is always a route back to editing them. Never a red failure signal. The pickers and the featured goal use the filtered `goals()`/`chaptersIn()`; the Story page uses `allGoals()`/`allChaptersIn()`.
- Dates use **local** calendar time, never `toISOString()`, which is UTC and stamps the previous day after midnight in a positive-offset timezone.
- **A modal is a list of fields.** `textField()`, `dateField()`, `selectField()` and `modalFooter()` build the markup, `val()` reads a field, `saveAndReturn()` ends the common case. Adding a modal is a short function, not another copy of the same markup. The delete *cascade* stays in `DELETE_RULES` and is never modal configuration; `wireDelete()` is only the wiring, which is identical for every kind.
- No em dashes in UI copy. Commas.
