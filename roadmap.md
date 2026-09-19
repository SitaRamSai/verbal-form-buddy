# Roadmap

- [x] Add welcome script to landing page (approved plan)
- [x] Build split-view page: voice panel on left, real PDF form on right; speech fills the form
- [x] Switch to the project's real form: Texas Driver License / ID Card Application (DL-14A)
- [ ] Confirm whether the welcome script wording should mention DL-14A instead of Utility Assistance

## Guided conversation flow
- [ ] Welcome greeting → "which form would you like to work on?" (TX DL-14A only) → question-by-question filling
- [ ] Use the OCR-extracted DL-14A schema (src/lib/dl-14a-schema.json) as the source of question prompts
- [ ] Later: cover schema fields the PDF filler doesn't map yet (sex, eye/hair colour, race, ethnicity, eligibility questions, application type/class)

## Team split (3 parts)
- [ ] Person A: source forms + test data (DL-14A received)
- [x] Voice: speech recognition + form filling (this app) — owned by user
- [ ] OCR correction: scan/OCR a paper form, review + correct extracted fields (third person) — not started

## Architecture page (judge-facing)
- [x] "Architecture" nav item on the app page + separate /architecture page: system flow diagram (2 rows desktop / vertical mobile), service map cards, agent workflow (drafted by Lovable — user may supply exact wording)
