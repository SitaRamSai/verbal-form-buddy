# Keep session memory so questions aren't repeated

Right now the agent only remembers the *immediately previous* question. If a question comes back around after a detour, it gets asked again as if it were new. And if the page reloads mid-interview, everything is forgotten and the interview restarts from the top.

## What changes

1. **A real session memory.** For the whole session the agent keeps track of: every answer given, every question already asked (and how many times), and everything the user skipped or couldn't answer. A question that has already been answered or already been asked twice is never asked again — the agent moves to the next missing detail instead.

2. **Nothing is asked that the user already typed.** Details entered on the "About you" card, or corrected in the review list, immediately count as answered and drop out of the question queue.

3. **The session survives a reload.** Answers, asked-question history and skipped items are saved in the browser, so refreshing the page continues the same interview instead of starting over. "Start over" clears it.

4. **The AI hears the context.** Each time the agent interprets what was said, it is also told what's already known and which question was just asked, so it stops re-deriving details it already has and places short answers on the right field.

5. **A gentle wrap-up.** When only skipped items are left, the agent says once which details are still blank and points to the review list, rather than circling back through them.

## Technical notes

- `src/lib/dmv-agent.ts`: replace the `lastTargets`/`askCount` pair with a session record — `answered: Set<string>`, `askedCount: Map<string, number>`, `skipped: Set<string>`. `decide()` picks the first missing field group whose asked-count is below the limit; at the limit the group moves to `skipped` and is excluded from all later passes. Add `toJSON()` / `static fromJSON()` for persistence and `markAnswered(keys)` called from `applyExtractedValues`, `seedProfile`, and manual review-list edits.
- `src/routes/index.tsx`: persist the serialized agent to `localStorage` (key `formbuddy-session`) after each decision; rehydrate into `agentRef` on mount; clear on the existing reset handler. Manual edits in the review list call `markAnswered`.
- `src/lib/extract-dmv.functions.ts`: already accepts `known`; pass the current non-empty values plus the pending question, and extend the system prompt to say the known values must not be re-emitted unless the user corrects them.
- No UI redesign, no new fields, no backend changes.
