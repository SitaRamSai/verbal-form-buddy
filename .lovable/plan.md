# Add welcome script to FormBuddy landing page

## Goal
Show the agent's opening script on the app so users know what to expect before starting:

> "Welcome to FormBuddy. We'll complete the Utility Assistance application together. There are six steps. You can say 'repeat,' 'why do they need this,' 'save for later,' or 'what documents do I need?'"

There is currently no About page — the site is a blank placeholder — so this becomes the first real content on the home page.

## Changes

1. **`src/routes/index.tsx`** — replace the blank placeholder with a simple landing page:
   - FormBuddy title and one-line description (voice agent that helps fill out a Utility Assistance application).
   - A "Welcome script" card styled like a chat/transcript bubble containing the exact script text above.
   - The four voice commands ("repeat", "why do they need this", "save for later", "what documents do I need?") shown as small chips under the script for quick scanning.
   - Route-specific `head()` with title "FormBuddy — Voice Agent for Utility Assistance" and matching description.

2. **`src/routes/__root.tsx`** — update the root title away from the template default so the app is no longer "Lovable App".

## Not included
- No voice recording, AI, or form logic yet — this is presentation only, matching the request.
- The broader voice-agent build (six-step flow, mic input, document checklist) stays available as a follow-up if you want it.
