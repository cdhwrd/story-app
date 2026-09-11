# Roadmap

### Current priorities

Product, roughly in order:

1. **Deleted Stories keep their Journey entries.** Blocked until the timeline exists, because every current view finds entries by Story, so preserved entries would be invisible. Denormalise the Story name onto them as text.
2. **A derived line on the Story page**, stating something true about the record ("part of your life since March, 14 marks"). Needs a Story start date; `createdAt` exists on newer Stories, older ones may need backfilling.
3. **The return band.** After a quiet stretch, home opens with something the person wrote and how long the Story has existed. Triggered off the date of the most recent Journey entry, never off a stored "last opened", so it responds to the story being quiet rather than tracking the person. No call to action, never a modal, never mentions the gap.
4. **Practice endings.** `resting` and `woven` statuses, so a practice can be set down or graduate instead of only being deleted.
5. **Monthly Issue.** Cut by accumulation rather than by calendar, so it never has a thin month. Entries selected by structural rule only (the first time, where it started), never by sentiment, and the rule is stated as the section heading so nothing feels cherry-picked.

Events are done: the record, the timeline, the month grid, recurrence and `.ics` export. What remains on them is in Known open items, and skipping a single occurrence is the one most likely to bite.

Codebase, whenever there is appetite:

- **CSS consolidation.** 37 selectors have more than one base-layer definition, and the breakpoints repeat: three `@media(max-width:900px)` blocks and two at 560px. `tests/conventions.test.js` holds the live count as a ceiling that may only fall.
- **File split.** Optional and last. Requires changing the service worker to network-first for all same-origin assets in the same commit. See [Why one file](architecture.md#why-one-file).

Design principles that constrain all of the above are in [Visual direction](design.md#visual-direction) and [Deliberately removed](design.md#deliberately-removed).

### Known open items

- Practices have no ending. A Practice can only be deleted, not set down or marked as "woven in" (this is just what I do now, stop counting). A `status` of `resting` / `woven` is the intended next move
- A Practice can only be created by adding a Step and converting it in the edit modal. Quick-add always produces a one-off, deliberately, to keep that row a single field
- Converting an existing Step to a Practice brings the record forward but not its history: earlier one-off completions of the same activity stay as separate records and don't gather into the mark count
- Practices appear in the home page "Next steps" teaser alongside one-off steps, undifferentiated
- Completed steps aren't listed anywhere outside the Journey, though they can be reopened from there
- What a Chapter should *be* is still open. In practice they are mostly year-shaped ("2026: becoming a musician") but not always, so no year field has been formalised
- The Story page is macro; there is no focused "what do I do now" view
- `completedAt` is date-only while `createdAt` is a full ISO timestamp
- An `.ics` event with no `DTEND` is written without one, which the spec allows but some importers read as zero length
- `.ics` export emits `TZID` without a matching `VTIMEZONE` component. Google and Apple both accept this; a strict parser may not
- `.ics` is export only. Story cannot read a calendar file back in
- Reminders are stored nowhere, so nothing is exported for them either
- Recurring events cannot skip or move a single occurrence. `EXDATE` and `RECURRENCE-ID` are not supported, so a cancelled week means editing the rule
- Story cannot fire a reminder. An installed PWA cannot schedule a notification for a future date on Android: Notification Triggers never shipped, and web notifications only fire while something is running. A reminder can be stored and exported so Google fires it, but Story itself will never buzz your phone
- "Monthly Issue" (a magazine-style summary of your Journey, with photos) is planned but not started. The data model doesn't yet support attaching photos to Journey entries
