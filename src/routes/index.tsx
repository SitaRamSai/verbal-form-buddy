import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleStop,
  FileText,
  Mic,
  MicOff,
  MessageCircle,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FormBuddy — Voice Agent for Utility Assistance" },
      {
        name: "description",
        content:
          "Speak naturally and FormBuddy fills out the Utility Assistance application for you, one step at a time.",
      },
      { property: "og:title", content: "FormBuddy — Voice Agent for Utility Assistance" },
      {
        property: "og:description",
        content:
          "Speak naturally and FormBuddy fills out the Utility Assistance application for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

const DOCUMENTS = [
  "Photo ID",
  "Proof of income (last 30 days)",
  "Recent utility bill",
  "Proof of address (lease or mortgage)",
  "Social Security numbers for household members",
];

const FIELD_HINTS: Record<keyof FormValues, string> = {
  fullName: "They use it to verify your identity on the application.",
  dateOfBirth: "It confirms your identity and checks age-based programs.",
  phone: "The utility office calls this number about your application.",
  email: "They send your approval decision and status updates here.",
  address: "Your address decides which utility company serves you.",
  householdSize: "Income limits depend on how many people live with you.",
  monthlyIncome: "Assistance is income-based; this decides your eligibility.",
  utilityProvider: "They need to know which company sends your bill.",
  accountNumber: "It links the assistance payment to your utility account.",
};

const DRAFT_KEY = "formbuddy-draft";

const FORM_FIELDS: { field: keyof FormValues; type: string; placeholder: string; wide?: boolean }[] = [
  { field: "fullName", type: "text", placeholder: "e.g. Maria Lopez", wide: true },
  { field: "dateOfBirth", type: "text", placeholder: "e.g. January 5, 1985" },
  { field: "phone", type: "text", placeholder: "e.g. (555) 123-4567" },
  { field: "email", type: "text", placeholder: "e.g. maria@example.com", wide: true },
  { field: "address", type: "text", placeholder: "e.g. 42 Elm Street, Springfield", wide: true },
  { field: "householdSize", type: "text", placeholder: "e.g. 4" },
  { field: "monthlyIncome", type: "text", placeholder: "e.g. $2,400" },
  { field: "utilityProvider", type: "text", placeholder: "e.g. City Power & Light", wide: true },
  { field: "accountNumber", type: "text", placeholder: "e.g. 1234567890", wide: true },
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
    if (keys.length === 0) {
      setStatus(`I heard: “${text}”. Try naming the field, like “my name is…”.`);
      return;
    }
    setValues((current) => ({ ...current, ...parsed }));
    setJustFilled(new Set(keys));
    lastFilledRef.current = keys;
    setStatus(`Filled ${keys.map((k) => FIELD_LABELS[k]).join(", ")}.`);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            FormBuddy
          </h1>
          <p className="text-sm text-muted-foreground">
            Utility Assistance application — speak and FormBuddy fills in the form.
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
                  “{WELCOME_SCRIPT}”
                </p>
              </div>
            </div>

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
                  Utility Assistance Application
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official Form UA-6 (PDF) — filled live as you speak
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
                download="utility-assistance-application.pdf"
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
      </main>
    </div>
  );
}
