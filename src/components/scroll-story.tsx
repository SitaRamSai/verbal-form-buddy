import {
  CheckCircle2,
  CircleDashed,
  FileText,
  HelpCircle,
  Lock,
  Mic,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Reveals children with a fade + slide once they enter the viewport. */
function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "true" : undefined}
      style={{ transitionDelay: `${delay}ms` }}
      className={`motion-safe:translate-y-4 motion-safe:opacity-0 motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out ${
        shown ? "motion-safe:!translate-y-0 motion-safe:!opacity-100" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const buttonBase =
  "inline-flex items-center justify-center rounded-lg px-5 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const CROWDED_LINES = [
  "Applicant full legal name",
  "Proof of income",
  "Household size",
  "Supporting documentation",
  "Residence address",
  "Utility account number",
  "Prior assistance received",
  "Signature of applicant",
  "Date of application",
];

const STEPS = [
  {
    num: "01",
    title: "Understand",
    body: "Read the form and find fields, requirements, and documents.",
  },
  {
    num: "02",
    title: "Guide",
    body: "Ask one clear question at a time by voice, keyboard, or screen reader.",
  },
  {
    num: "03",
    title: "Protect",
    body: "Confirm important answers. Never capture SSNs, passwords, bank details, or card numbers.",
  },
  {
    num: "04",
    title: "Prepare",
    body: "Show completed answers, missing documents, and a reviewable packet.",
  },
];

export function ScrollStory({ appAnchorId }: { appAnchorId: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* SECTION 1 — HERO */}
      <section
        aria-labelledby="story-hero"
        className="grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28"
      >
        <div>
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">FORMBUDDY</p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              id="story-hero"
              className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              The form is not the task. Getting help is.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A voice-first guide that turns complicated assistance forms into clear next steps—so
              blind and low-vision people can prepare applications independently.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => scrollToId(appAnchorId)}
                className={`${buttonBase} bg-primary text-primary-foreground hover:opacity-90`}
              >
                Try the guided form
              </button>
              <button
                type="button"
                onClick={() => scrollToId("story-path")}
                className={`${buttonBase} border border-border bg-card text-foreground hover:bg-accent`}
              >
                See how it works
              </button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200} className="grid gap-4 sm:grid-cols-2">
          {/* Dense paper form card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Assistance application
            </div>
            <div className="mt-4 space-y-2.5" aria-hidden="true">
              {CROWDED_LINES.slice(0, 7).map((line) => (
                <div key={line}>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {line}
                  </div>
                  <div className="mt-1 h-3 rounded border border-border bg-muted" />
                </div>
              ))}
            </div>
            <p className="sr-only">
              Illustration: a dense paper form with nine crowded fields and small labels.
            </p>
          </div>

          {/* Calm conversation card */}
          <div className="self-start rounded-2xl border border-primary bg-accent p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Mic className="h-4 w-4" aria-hidden="true" />
              FormBuddy
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Step 2 of 6 — Household</p>
            <p className="mt-3 text-lg font-semibold leading-snug text-foreground">
              How many people live in your home?
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Say a number. You can also say “why are they asking this?”
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary">
              <Mic className="h-4 w-4" aria-hidden="true" />
              Hold to speak
            </div>
          </div>
        </Reveal>
      </section>

      {/* SECTION 2 — THE BARRIER */}
      <section aria-labelledby="story-barrier" className="border-t border-border py-20 lg:py-28">
        <Reveal>
          <h2
            id="story-barrier"
            className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl"
          >
            Help should not depend on navigating paperwork.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Jordan can use a screen reader and document-reading tools. But a long form can still
            hide what matters: required documents, unclear instructions, and what remains before
            submission.
          </p>
        </Reveal>

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <Reveal className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Before
            </p>
            <div className="mt-4 space-y-2" aria-hidden="true">
              {CROWDED_LINES.map((line) => (
                <div key={line} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-[11px] text-muted-foreground">
                    {line}
                  </span>
                  <span className="h-3 flex-1 rounded border border-border bg-muted" />
                </div>
              ))}
            </div>
            <p className="sr-only">
              Nine crowded input lines, including proof of income and supporting documentation.
            </p>
          </Reveal>

          <Reveal delay={120} className="justify-self-center">
            <span
              className="block h-16 w-px bg-border lg:h-px lg:w-16"
              aria-hidden="true"
            />
          </Reveal>

          <Reveal delay={200} className="rounded-2xl border border-primary bg-accent p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">After</p>
            <p className="mt-4 text-sm font-semibold text-foreground">
              Step 3 of 6 — Income verification
            </p>
            <p className="mt-3 text-2xl font-semibold leading-snug text-foreground">
              What proof of income do you have?
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              Why are they asking this?
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary">
              <Mic className="h-4 w-4" aria-hidden="true" />
              Hold to speak
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Example only — the working form is below.
            </p>
          </Reveal>
        </div>
      </section>

      {/* SECTION 3 — THE PATH */}
      <section
        id="story-path"
        aria-labelledby="story-path-heading"
        className="scroll-mt-8 border-t border-border py-20 lg:py-28"
      >
        <Reveal>
          <h2
            id="story-path-heading"
            className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl"
          >
            One path. One question at a time.
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.num} delay={i * 120}>
              <div className="group h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-bold tracking-widest text-primary">{step.num}</span>
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{step.body}</p>
                <span
                  className="mt-5 block h-0.5 w-full origin-left scale-x-0 bg-primary transition-transform duration-700 [[data-shown]_&]:scale-x-100 motion-reduce:scale-x-100"
                  aria-hidden="true"
                />
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* SECTION 4 — THE OUTCOME */}
      <section aria-labelledby="story-outcome" className="border-t border-border py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <h2
                id="story-outcome"
                className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl"
              >
                Ready to apply, before it is time to submit.
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-foreground">
                Other tools help Jordan read a form. FormBuddy helps Jordan get ready to finish it.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <button
                type="button"
                onClick={() => scrollToId(appAnchorId)}
                className={`${buttonBase} mt-8 bg-primary text-primary-foreground hover:opacity-90`}
              >
                Start with voice
              </button>
            </Reveal>
          </div>

          <Reveal
            delay={160}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:p-8"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Application readiness
            </h3>
            <p className="mt-4 text-2xl font-semibold text-foreground">8 of 9 questions complete</p>
            <ul className="mt-6 space-y-4 text-base">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-foreground">Proof of income confirmed</span>
              </li>
              <li className="flex items-start gap-3">
                <CircleDashed
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">One thing remains: a current utility bill</span>
              </li>
              <li className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-foreground">Sensitive field stays private</span>
              </li>
            </ul>
            <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Example readiness summary — nothing is submitted for you.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
