# Voice-Filled Form

A single page where you press a mic button, speak naturally, and watch the form fields fill themselves in. You can always type over anything it gets wrong.

## The form
A contact / lead capture form:
- Full name
- Email
- Phone
- Company
- Reason for reaching out (longer text)

## How it works for the user
1. Press "Start talking" and grant microphone access.
2. Speak freely: "Hi, I'm Ana Reyes, ana@acme.com, 312-555-0142, I work at Acme and I'd like a demo next week."
3. Live transcript appears under the mic button.
4. Press stop — fields populate, each newly filled field briefly highlights.
5. Review, edit anything by hand, submit. A confirmation summary appears.
6. "Clear and start over" resets everything.

Speaking again adds to what's already there rather than wiping it — only fields with new information get updated.

## Look and feel
Warm, calm, single-column card on a soft neutral background. Big circular mic button with an animated pulse ring while listening. Serif headings paired with a clean sans body — deliberately not a generic blue-gradient SaaS page.

## Technical notes
- Speech capture: browser Web Speech API (`webkitSpeechRecognition`), client-only, gated behind a hydration check with a clear fallback message on unsupported browsers (notably desktop Safari/Firefox) — those users can type instead.
- Field extraction: a server function posts the transcript to the Lovable AI Gateway (`google/gemini-2.5-flash`) with a strict JSON schema for the five fields; unknown fields come back null and are left untouched. Handles 429/402 gracefully with a toast.
- Route: rewrite `src/routes/index.tsx` as the form page with its own `head()` metadata.
- Components: shadcn input/textarea/button/card + `sonner` toaster mounted in `__root.tsx`.
- Design tokens added to `src/styles.css`; no hardcoded colors in components.
- No database — submissions are not stored. Say the word and I'll add saved submissions with a history view.
