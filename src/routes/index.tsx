import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  BookOpen,
  Check,
  CircleStop,
  ClipboardCheck,
  FileText,
  Mic,
  MicOff,
  MessageCircle,
  ShieldCheck,
  UserRound,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_FORM,
  FIELD_LABELS,
  detectCommand,
  parseTranscript,
  type FormValues,
} from "@/lib/form-parser";
import { speak, useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { fillPdf, pdfBlobUrl } from "@/lib/pdf-form";
import { PdfPreview } from "@/components/pdf-preview";
import { extractFields } from "@/lib/extract.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FormBuddy — Voice Agent for the Texas DL-14A Application" },
      {
        name: "description",
        content:
          "Speak naturally and FormBuddy fills out the Texas Driver License / ID Card application (Form DL-14A) for you, one step at a time.",
      },
      { property: "og:title", content: "FormBuddy — Voice Agent for the Texas DL-14A Application" },
      {
        property: "og:description",
        content:
          "Speak naturally and FormBuddy fills out the Texas Driver License / ID Card application for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const WELCOME_SCRIPT =
  "Welcome to FormBuddy. We'll complete the Utility Assistance application together. There are six steps. You can say 'repeat,' 'why do they need this,' 'save for later,' or 'what documents do I need?'";

const INTRO_GREETING =
  "Hi, I'm FormBuddy. I help you finish government forms by voice, one question at a time.";

const FORM_QUESTION = "Which form would you like to work on today?";

const FORM_OPTIONS: { label: string; note: string; available: boolean }[] = [
  {
    label: "Texas Driver License / ID Card — Form DL-14A",
    note: "Texas DPS · ready to fill",
    available: true,
  },
  {
    label: "Utility Assistance application",
    note: "Coming soon",
    available: false,
  },
  {
    label: "Upload my own form",
    note: "Coming soon",
    available: false,
  },
];

const VOICE_COMMANDS = [
  "repeat",
  "why do they need this",
  "save for later",
  "what documents do I need?",
];

const DOCUMENTS = [
  "Proof of identity (birth certificate or passport)",
  "Social Security card or number",
  "Proof of Texas residency (two documents)",
  "Proof of U.S. citizenship or lawful presence",
  "Current insurance or vehicle registration (for a driver license)",
];

const FIELD_HINTS: Record<keyof FormValues, string> = {
  lastName: "It must match the name on your identity document.",
  firstName: "It must match the name on your identity document.",
  middleName: "Include it if it appears on your identity document.",
  dateOfBirth: "It confirms your identity and your eligibility by age.",
  ssn: "Texas requires your Social Security number on this application.",
  heightFeet: "Height is printed on the card and used to identify you.",
  heightInches: "Height is printed on the card and used to identify you.",
  weight: "Weight is printed on the card and used to identify you.",
  placeOfBirthCity: "Place of birth helps confirm your identity records.",
  placeOfBirthState: "Place of birth helps confirm your identity records.",
  fathersLastName: "It is used to verify your identity records.",
  mothersMaidenName: "It is used to verify your identity records.",
  residenceAddress: "Texas requires the address where you actually live.",
  city: "Part of your residence address.",
  state: "Part of your residence address.",
  zipCode: "Part of your residence address.",
  county: "The county decides which office handles your application.",
  phone: "The driver license office calls this number about your application.",
  cellPhone: "A second number in case they cannot reach you.",
  email: "They send status updates and appointment notices here.",
  emergencyName: "Optional: who should be contacted in an emergency.",
  emergencyPhone: "Optional: how to reach your emergency contact.",
  emergencyAddress: "Optional: where your emergency contact lives.",
};

const DRAFT_KEY = "formbuddy-draft";

const FORM_FIELDS: { field: keyof FormValues; type: string; placeholder: string; wide?: boolean }[] = [
  { field: "firstName", type: "text", placeholder: "e.g. Maria" },
  { field: "middleName", type: "text", placeholder: "e.g. Elena" },
  { field: "lastName", type: "text", placeholder: "e.g. Lopez" },
  { field: "dateOfBirth", type: "text", placeholder: "e.g. 01/05/1985" },
  { field: "ssn", type: "text", placeholder: "e.g. 123-45-6789" },
  { field: "heightFeet", type: "text", placeholder: "e.g. 5" },
  { field: "heightInches", type: "text", placeholder: "e.g. 6" },
  { field: "weight", type: "text", placeholder: "e.g. 150" },
  { field: "placeOfBirthCity", type: "text", placeholder: "e.g. Houston" },
  { field: "placeOfBirthState", type: "text", placeholder: "e.g. Texas" },
  { field: "fathersLastName", type: "text", placeholder: "e.g. Lopez" },
  { field: "mothersMaidenName", type: "text", placeholder: "e.g. Garcia" },
  { field: "residenceAddress", type: "text", placeholder: "e.g. 42 Elm Street", wide: true },
  { field: "city", type: "text", placeholder: "e.g. Austin" },
  { field: "state", type: "text", placeholder: "e.g. TX" },
  { field: "zipCode", type: "text", placeholder: "e.g. 78701" },
  { field: "county", type: "text", placeholder: "e.g. Travis" },
  { field: "phone", type: "text", placeholder: "e.g. (555) 123-4567" },
  { field: "cellPhone", type: "text", placeholder: "e.g. (555) 987-6543" },
  { field: "email", type: "text", placeholder: "e.g. maria@example.com", wide: true },
  { field: "emergencyName", type: "text", placeholder: "e.g. Ana Lopez" },
  { field: "emergencyPhone", type: "text", placeholder: "e.g. (555) 222-3333" },
  { field: "emergencyAddress", type: "text", placeholder: "e.g. 10 Oak Ave, Austin", wide: true },
];

function Index() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [status, setStatus] = useState(WELCOME_SCRIPT);
  const [justFilled, setJustFilled] = useState<Set<keyof FormValues>>(new Set());
  const [showDocuments, setShowDocuments] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [stage, setStage] = useState<"welcome" | "choose" | "filling">("welcome");
  const lastFilledRef = useRef<(keyof FormValues)[]>([]);

  const handleTranscript = useCallback((text: string) => {
    const command = detectCommand(text);
    if (command === "repeat") {
      speak(WELCOME_SCRIPT);
      setStatus("Repeating the welcome message.");
      return;
    }
    if (command === "documents") {
      setShowDocuments(true);
      setStatus("Here's the document checklist.");
      return;
    }
    if (command === "why") {
      const last = lastFilledRef.current[0];
      setStatus(
        last
          ? `${FIELD_LABELS[last]}: ${FIELD_HINTS[last]}`
          : "Fill a field first, then ask 'why do they need this'."
      );
      return;
    }
    if (command === "save") {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        setStatus("Your application is saved for later on this device.");
      } catch {
        setStatus("Couldn't save the draft in this browser.");
      }
      return;
    }

    const parsed = parseTranscript(text);
    const keys = Object.keys(parsed) as (keyof FormValues)[];
    if (keys.length > 0) {
      setValues((current) => ({ ...current, ...parsed }));
      setJustFilled(new Set(keys));
      lastFilledRef.current = keys;
      setStatus(`Filled ${keys.map((k) => FIELD_LABELS[k]).join(", ")}.`);
    } else {
      setStatus(`I heard: “${text}”. Letting AI take a look…`);
    }

    // Ask the AI to catch anything the quick rules missed.
    setAiThinking(true);
    extractFields({ data: { transcript: text } })
      .then((result) => {
        const extra = Object.entries(result.values).filter(
          ([field, value]) => value && !parsed[field as keyof FormValues],
        ) as [keyof FormValues, string][];
        if (extra.length === 0) {
          if (keys.length === 0) {
            setStatus(
              result.error ??
                `I heard: “${text}”, but couldn't tell which field it belongs to.`,
            );
          }
          return;
        }
        const extraKeys = extra.map(([field]) => field);
        setValues((current) => {
          const next = { ...current };
          for (const [field, value] of extra) next[field] = value;
          return next;
        });
        setJustFilled(new Set([...keys, ...extraKeys]));
        lastFilledRef.current = [...extraKeys, ...keys];
        setStatus(
          `Filled ${[...keys, ...extraKeys].map((k) => FIELD_LABELS[k]).join(", ")}.`,
        );
      })
      .catch(() => {
        if (keys.length === 0) setStatus(`I heard: “${text}”, but the AI couldn't be reached.`);
      })
      .finally(() => setAiThinking(false));
  }, [values]);

  const { supported, listening, interim, toggle } =
    useSpeechRecognition(handleTranscript);

  // Restore a saved draft on first load (client only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        setValues({ ...EMPTY_FORM, ...JSON.parse(saved) });
        setStatus("Welcome back — your saved draft was restored.");
        setStage("filling");
      }
    } catch {
      // ignore malformed drafts
    }
  }, []);

  // Re-fill the real PDF whenever the collected values change.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([fillPdf(values, { flatten: true }), fillPdf(values)])
        .then(([flat, editable]) => {
          if (cancelled) return;
          setPdfError(null);
          setPdfBytes(flat);
          setPdfUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return pdfBlobUrl(editable);
          });
        })
        .catch(() => {
          if (!cancelled) setPdfError("Couldn't open the application PDF.");
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values]);

  const filledCount = FORM_FIELDS.filter(({ field }) => values[field]).length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              FormBuddy
            </h1>
            <nav aria-label="Main">
              <Link
                to="/architecture"
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Architecture
              </Link>
            </nav>
          </div>
          <p className="text-sm text-muted-foreground">
            Texas Driver License / ID Card application — speak and FormBuddy fills in the form.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: voice panel */}
          <section
            aria-label="Voice panel"
            className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm lg:sticky lg:top-8"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Voice agent
              </h2>
            </div>

            <div className="rounded-lg rounded-tl-sm bg-muted p-4">
              <div className="flex items-start gap-3">
                <MessageCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-foreground">
                  {stage === "welcome"
                    ? `“${INTRO_GREETING}”`
                    : stage === "choose"
                      ? `“${FORM_QUESTION}”`
                      : `“${WELCOME_SCRIPT}”`}
                </p>
              </div>
            </div>

            {stage === "welcome" && (
              <button
                type="button"
                onClick={() => {
                  setStage("choose");
                  setStatus(FORM_QUESTION);
                  speak(`${INTRO_GREETING} ${FORM_QUESTION}`);
                }}
                className="rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Let's begin
              </button>
            )}

            {stage === "choose" && (
              <ul className="flex flex-col gap-2">
                {FORM_OPTIONS.map((option) => (
                  <li key={option.label}>
                    <button
                      type="button"
                      disabled={!option.available}
                      onClick={() => {
                        setStage("filling");
                        setStatus(WELCOME_SCRIPT);
                        speak(WELCOME_SCRIPT);
                      }}
                      className={
                        "w-full rounded-lg border p-3 text-left transition-colors " +
                        (option.available
                          ? "border-border bg-background text-foreground hover:bg-accent"
                          : "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-70")
                      }
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.note}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {stage === "filling" && (
              <>
            <div className="flex flex-col items-center gap-3 py-2">
              <button
                type="button"
                onClick={toggle}
                disabled={!supported}
                aria-pressed={listening}
                className={
                  "flex h-20 w-20 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
                  (listening
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent")
                }
                aria-label={listening ? "Stop listening" : "Start listening"}
              >
                {listening ? (
                  <CircleStop className="h-9 w-9" aria-hidden="true" />
                ) : supported ? (
                  <Mic className="h-9 w-9" aria-hidden="true" />
                ) : (
                  <MicOff className="h-9 w-9" aria-hidden="true" />
                )}
              </button>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {listening
                  ? "Listening… speak naturally."
                  : supported
                    ? "Tap the mic, then just talk."
                    : "Voice input needs Chrome or Edge on desktop."}
              </p>
              {interim && (
                <p className="max-w-full rounded-md bg-muted px-3 py-1 text-sm italic text-muted-foreground">
                  {interim}…
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {VOICE_COMMANDS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => handleTranscript(command)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  “{command}”
                </button>
              ))}
            </div>
              </>
            )}


            {showDocuments && (
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Documents you'll need
                  </h3>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {DOCUMENTS.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" aria-live="polite">
              {status}
              {aiThinking && (
                <span className="ml-2 text-muted-foreground">AI is checking…</span>
              )}
            </p>
          </section>

          {/* Right: the real PDF form */}
          <section
            aria-label="Application form"
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Texas Driver License / ID Card Application
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official Form DL-14A (PDF) — filled live as you speak
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {filledCount}/{FORM_FIELDS.length} filled
              </span>
            </div>

            <div className="max-h-[760px] overflow-auto rounded-lg border border-border bg-muted p-3">
              {pdfError ? (
                <p className="p-6 text-sm text-muted-foreground">{pdfError}</p>
              ) : (
                <div className="shadow-sm">
                  <PdfPreview bytes={pdfBytes} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={pdfUrl ?? "#"}
                download="dl-14a-application.pdf"
                aria-disabled={!pdfUrl}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Download filled PDF
              </a>
              <button
                type="button"
                onClick={() => setShowReview((v) => !v)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {showReview ? "Hide corrections" : "Review & correct"}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
                    setStatus("Your application is saved for later on this device.");
                  } catch {
                    setStatus("Couldn't save the draft in this browser.");
                  }
                }}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Save for later
              </button>
              <button
                type="button"
                onClick={() => {
                  setValues(EMPTY_FORM);
                  setJustFilled(new Set());
                  setStatus("Form cleared.");
                }}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Clear
              </button>
            </div>

            {showReview && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-2">
                {FORM_FIELDS.map(({ field, type, placeholder, wide }) => (
                  <div key={field} className={wide ? "sm:col-span-2" : undefined}>
                    <label
                      htmlFor={`field-${field}`}
                      className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
                    >
                      {FIELD_LABELS[field]}
                      {justFilled.has(field) && values[field] && (
                        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                      )}
                    </label>
                    <input
                      id={`field-${field}`}
                      type={type}
                      value={values[field]}
                      onChange={(e) => {
                        setValues((current) => ({
                          ...current,
                          [field]: e.target.value,
                        }));
                        setJustFilled((current) => {
                          const next = new Set(current);
                          next.delete(field);
                          return next;
                        });
                      }}
                      placeholder={placeholder}
                      className={
                        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (justFilled.has(field) && values[field]
                          ? "border-primary ring-1 ring-primary"
                          : "")
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Why FormBuddy — judge-friendly story section */}
        <section aria-label="Why FormBuddy" className="mt-10 flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Why FormBuddy? Meet Jordan
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Jordan is a blind/low-vision resident applying for utility
            assistance. His story shows the gap FormBuddy fills.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Jordan&rsquo;s problem
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Jordan can use a screen reader and tools that read documents
                aloud. But a long utility-assistance form is still hard to
                finish independently: requirements are scattered, language is
                confusing, he can lose track of progress, and he may not know
                which documents are still missing.
              </p>
            </article>

            <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  What exists today
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Screen readers, Seeing AI, and Be My AI can read or describe a
                page. Caseworkers can help complete forms. But reading a form
                is not the same as preparing a complete application.
              </p>
              <p className="mt-auto text-xs italic leading-relaxed text-muted-foreground">
                FormBuddy does not replace these tools or a caseworker.
              </p>
            </article>

            <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  What FormBuddy does
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                FormBuddy creates a voice-first completion plan: it turns the
                form into one clear question at a time, remembers answers and
                missing documents, requires confirmation for important answers,
                protects sensitive fields, and creates a reviewable answer
                packet.
              </p>
            </article>
          </div>

          <p className="rounded-lg border border-primary bg-accent px-4 py-3 text-sm font-semibold text-primary">
            Other tools help Jordan read the form. FormBuddy helps Jordan
            finish preparing it.
          </p>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            FormBuddy never captures or speaks SSNs, bank details, card
            numbers, routing numbers, or passwords. Jordan reviews all answers
            before export and submits through the official channel.
          </p>
        </section>
      </main>
    </div>
  );
}
