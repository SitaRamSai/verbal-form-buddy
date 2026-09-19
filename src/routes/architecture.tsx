import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowRight,
  Bot,
  Braces,
  Brain,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  FileScan,
  Landmark,
  Mic,
  ScanText,
  Send,
  ShieldCheck,
  Volume2,
} from "lucide-react";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "FormBuddy Architecture" },
      {
        name: "description",
        content:
          "A supervised, voice-first workflow for turning complex forms into accessible guided completion.",
      },
      { property: "og:title", content: "FormBuddy Architecture" },
      {
        property: "og:description",
        content:
          "A supervised, voice-first workflow for turning complex forms into accessible guided completion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchitecturePage,
});

const FLOW_STEPS = [
  { label: "Jordan", icon: Accessibility },
  { label: "FormBuddy Web App (Lovable)", icon: Bot },
  { label: "Backend Orchestrator", icon: ShieldCheck },
  { label: "PaddleOCR", icon: ScanText },
  { label: "Form Mapper + Form Schema", icon: Braces },
  { label: "Gemini Flash Structured Agent", icon: Brain },
  { label: "Google Speech-to-Text / Google Text-to-Speech", icon: Mic },
  { label: "Confirmed Draft State", icon: CheckCircle2 },
  { label: "Review & Export Packet", icon: FileDown },
  { label: "Jordan manually submits through the official channel", icon: Landmark },
];

const SERVICES = [
  {
    name: "Lovable Web App",
    icon: Bot,
    points: ["Accessible UI, upload, guided form, voice controls, progress, review"],
  },
  {
    name: "Backend Orchestrator",
    icon: ShieldCheck,
    points: ["Session state, validation, confirmation policy, allowed actions, export"],
  },
  {
    name: "PaddleOCR",
    icon: ScanText,
    points: ["Extracts text, layout, labels, and field locations from a PDF/photo"],
  },
  {
    name: "Gemini Flash",
    icon: Brain,
    points: [
      "Converts form schema and user transcript into validated structured next actions",
      "Never submits forms or determines eligibility",
    ],
  },
  {
    name: "Google Speech-to-Text",
    icon: Mic,
    points: ["Converts one short spoken answer into editable text"],
  },
  {
    name: "Google Text-to-Speech",
    icon: Volume2,
    points: ["Reads questions, explanations, and confirmations aloud"],
  },
  {
    name: "Form Schema + Draft State",
    icon: ClipboardList,
    points: [
      "Stores only demo answers after user confirmation",
      "Tracks field status and missing documents",
    ],
  },
];

const AGENT_STEPS = [
  {
    title: "Ask one question at a time",
    body: "Text-to-speech reads the next question aloud so Jordan always knows exactly what is being asked.",
  },
  {
    title: "Jordan answers in one short sentence",
    body: "One answer per turn keeps the conversation simple and easy to repeat or correct.",
  },
  {
    title: "Speech becomes editable text",
    body: "Google Speech-to-Text turns the single spoken answer into text Jordan can review.",
  },
  {
    title: "Gemini proposes a structured action",
    body: "The agent maps the transcript onto the form schema and suggests the next action — nothing more.",
  },
  {
    title: "The backend validates every suggestion",
    body: "Only allowed fields, formats, and actions pass. Sensitive fields are rejected before they reach the draft.",
  },
  {
    title: "Jordan confirms before anything is saved",
    body: "The proposed answer is read back aloud. The draft only updates after Jordan confirms.",
  },
  {
    title: "Draft state tracks progress",
    body: "Confirmed answers, missing fields, and missing documents are tracked until the packet is complete.",
  },
  {
    title: "Review and export",
    body: "FormBuddy assembles a reviewable answer packet that Jordan submits himself through the official channel.",
  },
];

function FlowNode({
  label,
  Icon,
  isJordan,
}: {
  label: string;
  Icon: typeof Accessibility;
  isJordan?: boolean;
}) {
  return (
    <div
      className={
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium " +
        (isJordan
          ? "border-primary bg-accent text-primary"
          : "border-border bg-card text-foreground")
      }
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="leading-snug">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0 lg:px-1" aria-hidden="true">
      <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground lg:rotate-0" />
    </div>
  );
}

function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-10 flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              FormBuddy Architecture
            </h1>
            <Link
              to="/"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Back to the app
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            A supervised, voice-first workflow for turning complex forms into
            accessible guided completion.
          </p>
        </header>

        {/* 1. System flow */}
        <section aria-labelledby="system-flow" className="mb-12">
          <h2 id="system-flow" className="mb-4 text-xl font-bold tracking-tight text-foreground">
            1. System flow
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div
              className="flex flex-col"
              role="list"
              aria-label="System flow from Jordan to manual submission"
            >
              {[FLOW_STEPS.slice(0, 5), FLOW_STEPS.slice(5)].map((row, rowIndex) => (
                <div key={rowIndex}>
                  <div className="flex flex-col lg:flex-row lg:items-stretch">
                    {row.map((step, i) => {
                      const globalIndex = rowIndex * 5 + i;
                      const isRowEnd = i === row.length - 1;
                      return (
                        <div
                          key={step.label}
                          className="flex flex-col lg:flex-row lg:flex-1 lg:items-stretch"
                        >
                          <div role="listitem" className="flex min-w-0 lg:flex-1">
                            <FlowNode
                              label={step.label}
                              Icon={step.icon}
                              isJordan={globalIndex === 0}
                            />
                          </div>
                          {globalIndex < FLOW_STEPS.length - 1 && (
                            <div
                              className={
                                "flex items-center justify-center py-1 lg:py-0 lg:px-1" +
                                (isRowEnd ? " lg:hidden" : "")
                              }
                              aria-hidden="true"
                            >
                              <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground lg:rotate-0" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {rowIndex === 0 && (
                    <div
                      className="hidden items-center justify-center py-2 lg:flex"
                      aria-hidden="true"
                    >
                      <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm font-semibold text-muted-foreground">
              “Models suggest. The backend validates. Jordan confirms.”
            </p>
          </div>
        </section>

        {/* 2. Service map */}
        <section aria-labelledby="service-map" className="mb-12">
          <h2 id="service-map" className="mb-4 text-xl font-bold tracking-tight text-foreground">
            2. Service map
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <article
                key={service.name}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <service.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {service.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* 3. Agent workflow */}
        <section aria-labelledby="agent-workflow">
          <h2 id="agent-workflow" className="mb-4 text-xl font-bold tracking-tight text-foreground">
            3. Agent workflow
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
            One loop, repeated for every question — a suggestion is never
            trusted on its own and never saved without confirmation.
          </p>
          <ol className="grid gap-4 md:grid-cols-2">
            {AGENT_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary bg-accent px-4 py-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-primary">
              Models suggest. The backend validates. Jordan confirms. FormBuddy
              never submits anything on Jordan's behalf — the finished packet is
              reviewed and submitted manually through the official channel.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <FileScan className="h-4 w-4 text-primary" aria-hidden="true" />
            <Send className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Prototype built for the hackathon — demo data only, nothing stored.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
