import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleStop,
  Download,
  Eye,
  FileCheck,
  FileText,
  Mic,
  MicOff,
  MessageCircle,
  RefreshCw,
  Sparkles,
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
import { createUtilityAssistancePdf, createPdfBlobUrl, downloadPdf } from "@/lib/pdf-service";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FormBuddy — Voice Agent for Utility Assistance PDF" },
      {
        name: "description",
        content:
          "Speak naturally and FormBuddy fills out the official Utility Assistance PDF application for you in real-time.",
      },
      { property: "og:title", content: "FormBuddy — Voice Agent for Utility Assistance PDF" },
      {
        property: "og:description",
        content:
          "Speak naturally and FormBuddy fills out the official Utility Assistance application for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const WELCOME_SCRIPT =
  "Welcome to FormBuddy. We'll complete the Utility Assistance application together. There are six steps. You can say 'repeat,' 'why do they need this,' 'save for later,' 'show pdf,' or 'what documents do I need?'";

const VOICE_COMMANDS = [
  "repeat",
  "why do they need this",
  "save for later",
  "show pdf",
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

const FORM_FIELDS: {
  field: keyof FormValues;
  type: string;
  placeholder: string;
  wide?: boolean;
}[] = [
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

const QUICK_TEST_PROMPTS = [
  {
    label: "Name & Address",
    text: "My name is Carlos Rodriguez and I live at 742 Evergreen Terrace Springfield IL 62704",
  },
  {
    label: "Phone & Email",
    text: "My phone number is 555-432-8765 and my email is carlos dot rodriguez at example dot com",
  },
  {
    label: "DOB & Income",
    text: "I was born on January 15, 1982 and our monthly income is about 2850 dollars with household size of 4",
  },
  {
    label: "Utility & Account",
    text: "My utility company is Springfield Electric and Power and account number is 8849201934",
  },
];

function Index() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [status, setStatus] = useState(WELCOME_SCRIPT);
  const [justFilled, setJustFilled] = useState<Set<keyof FormValues>>(new Set());
  const [showDocuments, setShowDocuments] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "pdf">("form");
  const [flattenPdf, setFlattenPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const lastFilledRef = useRef<(keyof FormValues)[]>([]);

  // Regenerate PDF whenever values change or flatten setting toggles
  const refreshPdf = useCallback(async (currentValues: FormValues, flatten: boolean) => {
    try {
      setIsGeneratingPdf(true);
      const bytes = await createUtilityAssistancePdf(currentValues, { flatten });
      const url = createPdfBlobUrl(bytes);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, []);

  useEffect(() => {
    void refreshPdf(values, flattenPdf);
  }, [values, flattenPdf, refreshPdf]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const handleTranscript = useCallback(
    (text: string) => {
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
            : "Fill a field first, then ask 'why do they need this'.",
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
      if (command === "pdf") {
        setViewMode("pdf");
        setStatus("Switched to the official PDF application preview.");
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
      setStatus(
        `Voice Agent filled ${keys.map((k) => FIELD_LABELS[k]).join(", ")} into both Form & PDF.`,
      );
    },
    [values],
  );

  const { supported, listening, interim, toggle } = useSpeechRecognition(handleTranscript);

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

  const handleDownload = async () => {
    try {
      const bytes = await createUtilityAssistancePdf(values, { flatten: flattenPdf });
      const filename = values.fullName
        ? `utility-assistance-${values.fullName.toLowerCase().replace(/\s+/g, "-")}.pdf`
        : "utility-assistance-application.pdf";
      downloadPdf(bytes, filename);
      setStatus(`Downloaded official filled PDF application: ${filename}`);
    } catch (err) {
      console.error("Download failed:", err);
      setStatus("Could not trigger PDF download.");
    }
  };

  const handleSimulateFullCarlos = () => {
    const carlos: FormValues = {
      fullName: "Carlos Rodriguez",
      dateOfBirth: "January 15, 1982",
      phone: "(555) 432-8765",
      email: "carlos.rodriguez@example.com",
      address: "742 Evergreen Terrace Springfield IL 62704",
      householdSize: "4",
      monthlyIncome: "$2,850",
      utilityProvider: "Springfield Electric and Power",
      accountNumber: "8849201934",
    };
    setValues(carlos);
    setJustFilled(new Set(Object.keys(carlos) as (keyof FormValues)[]));
    setStatus("Voice session completed: Filled Carlos Rodriguez's application.");
  };

  const filledCount = FORM_FIELDS.filter(({ field }) => values[field]).length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <main className="mx-auto w-full max-w-7xl">
        <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">FormBuddy</h1>
            <p className="text-sm text-muted-foreground">
              Utility Assistance voice agent — speak naturally and FormBuddy fills the official PDF
              AcroForm.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <FileCheck className="h-3.5 w-3.5" />
              PDF AcroForm Engine Active
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: voice panel (5 columns on wide screen) */}
          <section
            aria-label="Voice panel"
            className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm lg:sticky lg:top-8 lg:col-span-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Voice Agent
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {filledCount}/{FORM_FIELDS.length} fields populated
              </span>
            </div>

            <div className="rounded-lg rounded-tl-sm bg-muted p-4">
              <div className="flex items-start gap-3">
                <MessageCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-foreground">“{WELCOME_SCRIPT}”</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <button
                type="button"
                onClick={toggle}
                disabled={!supported}
                aria-pressed={listening}
                className={
                  "flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 " +
                  (listening
                    ? "scale-105 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 animate-pulse"
                    : "border-border bg-background text-foreground hover:bg-accent hover:scale-105")
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
              <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {listening
                  ? "Listening… speak naturally."
                  : supported
                    ? "Tap the mic, then just talk."
                    : "Voice input needs Chrome, Edge, or Safari."}
              </p>
              {interim && (
                <p className="max-w-full rounded-md bg-muted px-3 py-1 text-sm italic text-muted-foreground">
                  {interim}…
                </p>
              )}
            </div>

            {/* Spoken voice commands */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Voice Commands
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VOICE_COMMANDS.map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => handleTranscript(command)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    “{command}”
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Test Voice Prompts */}
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Quick Voice Simulations
                </p>
                <button
                  type="button"
                  onClick={handleSimulateFullCarlos}
                  className="text-xs font-semibold text-primary underline hover:text-primary/80"
                >
                  Fill Full Sample
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {QUICK_TEST_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleTranscript(item.text)}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <span className="font-medium text-primary">{item.label}:</span>
                    <span className="truncate pl-2 text-muted-foreground">“{item.text}”</span>
                  </button>
                ))}
              </div>
            </div>

            {showDocuments && (
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">Documents you'll need</h3>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {DOCUMENTS.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            <p
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              aria-live="polite"
            >
              {status}
            </p>
          </section>

          {/* Right: form or PDF panel (7 columns on wide screen) */}
          <section
            aria-label="Application display"
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-7"
          >
            {/* View Switcher & Action Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setViewMode("form")}
                    className={
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all " +
                      (viewMode === "form"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Web Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("pdf")}
                    className={
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all " +
                      (viewMode === "pdf"
                        ? "bg-background text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Official PDF Preview
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshPdf(values, flattenPdf)}
                  disabled={isGeneratingPdf}
                  title="Refresh PDF"
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  aria-label="Refresh PDF"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingPdf ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* View Mode 1: Web Form */}
            {viewMode === "form" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Utility Assistance Application
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Mapped automatically into official AcroForm document (Form UAP-2026-V1)
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {filledCount}/{FORM_FIELDS.length} filled
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                  <div className="flex gap-2">
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
                      className="rounded-md border border-input bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
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
                      className="rounded-md border border-input bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Clear
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewMode("pdf")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    View Official PDF &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* View Mode 2: PDF Live Document Preview */}
            {viewMode === "pdf" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Live AcroForm Document Preview
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Official State LIHEAP Form UAP-2026-V1 • Updated live from voice inputs
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flattenPdf}
                      onChange={(e) => setFlattenPdf(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Flatten fields (read-only)</span>
                  </label>
                </div>

                {/* PDF Iframe Viewer */}
                <div className="relative w-full h-[620px] rounded-lg border border-border overflow-hidden bg-slate-900 shadow-inner">
                  {pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      title="Filled Utility Assistance PDF Document"
                      className="h-full w-full border-none"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      Generating PDF Document...
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {filledCount} of {FORM_FIELDS.length} fields filled from voice session
                  </span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Official Filing Copy
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
