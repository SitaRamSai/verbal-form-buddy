# Roadmap

- [x] Add welcome script to landing page (approved plan)
- [x] Build split-view page: voice panel on left, real PDF form on right; speech fills the form
- [x] Switch to the project's real form: Texas Driver License / ID Card Application (DL-14A)
- [ ] Confirm whether the welcome script wording should mention DL-14A instead of Utility Assistance

## Team split (3 parts)
- [ ] Person A: source forms + test data (DL-14A received)
- [x] Voice: speech recognition + form filling (this app) — owned by user
- [ ] OCR correction: scan/OCR a paper form, review + correct extracted fields (third person) — not started

## Architecture page (judge-facing)
- [x] "Architecture" nav item on the app page + separate /architecture page: system flow diagram (2 rows desktop / vertical mobile), service map cards, agent workflow (drafted by Lovable — user may supply exact wording)

## Voice interview from hardwired JSON (Shreya)
- [ ] Read questions from src/lib/dl-14a-schema.json only (sections[].fields[]); ask field.prompt one at a time in section order
- [ ] Validate with field.type / field.options / field.required; save { key, value } per answer on the session
- [ ] Apply the system prompt + skip rules (awaiting paste)
- [ ] "start" / existing CTA begins the interview immediately; no new fields, no UI redesign
