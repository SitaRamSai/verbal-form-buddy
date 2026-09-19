import { createFileRoute } from "@tanstack/react-router";
import { Mic, MessageCircle, Volume2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FormBuddy — Voice Agent for Utility Assistance" },
      {
        name: "description",
        content:
          "FormBuddy is a voice agent that guides you through the Utility Assistance application, one step at a time.",
      },
      { property: "og:title", content: "FormBuddy — Voice Agent for Utility Assistance" },
      {
        property: "og:description",
        content:
          "A voice agent that guides you through the Utility Assistance application, one step at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "FormBuddy — Voice Agent for Utility Assistance" },
      {
        name: "twitter:description",
        content:
          "A voice agent that guides you through the Utility Assistance application, one step at a time.",
      },
    ],
  }),
  component: Index,
});

const WELCOME_SCRIPT =
  "Welcome to FormBuddy. We'll complete the Utility Assistance application together. There are six steps. You can say 'repeat,' 'why do they need this,' 'save for later,' or 'what documents do I need?'";

const VOICE_COMMANDS = [
  "repeat",
  "why do they need this",
  "save for later",
  "what documents do I need?",
];

function Index() {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            FormBuddy
          </h1>
          <p className="text-muted-foreground">
            A voice agent that walks you through the Utility Assistance
            application, one step at a time.
          </p>
        </header>

        <section
          aria-labelledby="welcome-script-heading"
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2
              id="welcome-script-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Welcome script
            </h2>
          </div>
          <div className="mt-4 rounded-lg rounded-tl-sm bg-muted p-4">
            <div className="flex items-start gap-3">
              <MessageCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p className="text-base leading-relaxed text-foreground">
                “{WELCOME_SCRIPT}”
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {VOICE_COMMANDS.map((command) => (
              <span
                key={command}
                className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
              >
                “{command}”
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Say any of these at any point during the application and FormBuddy
            will respond.
          </p>
        </section>
      </main>
    </div>
  );
}
