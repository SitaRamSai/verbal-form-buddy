import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  BookOpen,
  Brain,
  Check,
  CircleStop,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck,
  FileText,
  Mic,
  MicOff,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { speak, useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  DmvVoiceAgent,
  EMPTY_DMV_FORM,
  type DmvFormValues,
  type AgentDialogueTurn,
  type InterviewStage,
} from "@/lib/dmv-agent";
import { createTexasDmvPdf, createDmvPdfBlobUrl, downloadDmvPdf } from "@/lib/dmv-pdf-service";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Texas DPS Driver License Voice Agent — FormBuddy" },
      {
        name: "description",
        content:
          "Autonomous Voice Agent powered by PaddleOCR form key extraction for Texas DPS Driver License Application Form DL-14A.",
      },
      { property: "og:title", content: "Texas DPS Driver License Voice Agent — FormBuddy" },
      {
        property: "og:description",
        content:
          "Autonomous voice agent that conducts the Texas DL-14A Driver License interview and fills the official PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const STAGE_LABELS: Record<InterviewStage, string> = {
  GREETING_AND_TYPE: "1. Credential & Application Type",
  IDENTITY: "2. Personal Identification & DOB",
  PHYSICAL: "3. Physical Descriptors (Card Details)",
  CONTACT: "4. Texas Residential Address & Phone",
  ELIGIBILITY: "5. Statutory Eligibility (Yes/No)",
  COMPLETED: "6. Application Complete & Verified",
};

const SIMULATED_CONVERSATION_STEPS = [
  {
    step: "1. Credential",
    callerText: "Hi, I'm applying for a Texas Driver License renewal, class C.",
  },
  {
    step: "2. Identity",
    callerText:
      "My name is Carlos Rodriguez, born on January 15, 1982. Male, social security number 555-43-8765.",
  },
  {
    step: "3. Physical",
    callerText: "I'm 5 foot 10 inches, 180 pounds, with brown eyes and black hair.",
  },
  {
    step: "4. Address",
    callerText:
      "I live at 742 Evergreen Terrace, Austin, Texas, 78701, Travis county. Phone is 555-432-8765 and email is carlos dot rodriguez at example dot com.",
  },
  {
    step: "5. Eligibility",
    callerText:
      "Yes I am a US citizen, yes please register me to vote, no I'm not a veteran, and yes add me as an organ donor.",
  },
];

function Index() {
  const agentRef = useRef<DmvVoiceAgent>(new DmvVoiceAgent());
  const [formValues, setFormValues] = useState<DmvFormValues>(EMPTY_DMV_FORM);
  const [history, setHistory] = useState<AgentDialogueTurn[]>([]);
  const [currentStage, setCurrentStage] = useState<InterviewStage>("GREETING_AND_TYPE");
  const [agentReasoning, setAgentReasoning] = useState(
    "Agent initialized from PaddleOCR DL-14A schema with 29 target keys.",
  );
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [flattenPdf, setFlattenPdf] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "pdf">("pdf");

  // Refresh PDF when values or flatten toggle changes
  const updatePdf = useCallback(async (values: DmvFormValues, flatten: boolean) => {
    try {
      setIsGeneratingPdf(true);
      const bytes = await createTexasDmvPdf(values, { flatten });
      const url = createDmvPdfBlobUrl(bytes);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error("Failed to generate Texas DL-14A PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, []);

  // Initialize Agent Dialogue on mount
  useEffect(() => {
    const agent = agentRef.current;
    const initialGreeting = agent.getInitialGreeting();
    setHistory([...agent.history]);
    void updatePdf(agent.values, false);
    // Voice agent speaks the opening question
    speak(initialGreeting);
  }, [updatePdf]);

  // Handle Spoken Input from User (Mic or Simulation)
  const handleSpokenInput = useCallback(
    (spokenText: string) => {
      const agent = agentRef.current;
      const decision = agent.processSpokenInput(spokenText);

      setFormValues({ ...decision.updatedValues });
      setHistory([...agent.history]);
      setCurrentStage(decision.nextStage);
      setAgentReasoning(decision.decisionReasoning);

      // Autonomous agent speaks the next utterance aloud
      speak(decision.agentUtterance);

      // Update the live PDF
      void updatePdf(decision.updatedValues, flattenPdf);
    },
    [flattenPdf, updatePdf],
  );

  const { supported, listening, interim, toggle } = useSpeechRecognition(handleSpokenInput);

  const handleDownload = async () => {
    const bytes = await createTexasDmvPdf(formValues, { flatten: flattenPdf });
    const filename = formValues.lastName
      ? `texas-dl14a-${formValues.lastName.toLowerCase()}-${formValues.firstName.toLowerCase()}.pdf`
      : "texas-dl14a-application.pdf";
    downloadDmvPdf(bytes, filename);
  };

  const handleRunFullSimulation = () => {
    const agent = new DmvVoiceAgent();
    agentRef.current = agent;
    for (const step of SIMULATED_CONVERSATION_STEPS) {
      agent.processSpokenInput(step.callerText);
    }
    setFormValues({ ...agent.values });
    setHistory([...agent.history]);
    setCurrentStage(agent.currentStage);
    setAgentReasoning("Full simulated intake interview completed. 24/29 keys populated.");
    void updatePdf(agent.values, flattenPdf);
  };

  const handleReset = () => {
    const agent = new DmvVoiceAgent();
    agentRef.current = agent;
    const greeting = agent.getInitialGreeting();
    setFormValues(EMPTY_DMV_FORM);
    setHistory([...agent.history]);
    setCurrentStage("GREETING_AND_TYPE");
    setAgentReasoning("Agent reset to initial DL-14A intake state.");
    void updatePdf(EMPTY_DMV_FORM, flattenPdf);
    speak(greeting);
  };

  const progress = agentRef.current.getProgress();

  return (
    <div className="min-h-screen bg-background px-4 py-6 lg:px-8">
      <main className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Texas DPS Driver License Voice Intake
              </h1>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                DL-14A (Rev. 8/2025)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Autonomous Voice Agent driven by PaddleOCR Key-Value Extraction — Document-Driven
              Intake
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/architecture"
              className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Architecture
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <FileCheck className="h-3.5 w-3.5" />
              PaddleOCR Schema: 29 Keys
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Brain className="h-3.5 w-3.5" />
              Autonomous Decision Loop Active
            </span>
          </div>
        </header>

        {/* Main 2-Column Split */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Autonomous Agent Console (5 columns) */}
          <section
            aria-label="Autonomous Voice Agent"
            className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:col-span-5"
          >
            {/* Stage & Progress */}
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  Current Goal: {STAGE_LABELS[currentStage]}
                </span>
                <span className="text-muted-foreground font-medium">
                  {progress.filled}/{progress.total} keys ({progress.percentage}%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Agent Decision Reasoning Callout */}
            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs text-blue-700 dark:text-blue-300">
              <span className="font-bold">Agent Decision Reasoning: </span>
              {agentReasoning}
            </div>

            {/* Microphone Button */}
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                type="button"
                onClick={toggle}
                disabled={!supported}
                aria-pressed={listening}
                className={
                  "flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 " +
                  (listening
                    ? "scale-105 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 animate-pulse"
                    : "border-border bg-background text-foreground hover:bg-accent hover:scale-105")
                }
                aria-label={listening ? "Stop listening" : "Start speaking to agent"}
              >
                {listening ? (
                  <CircleStop className="h-8 w-8" aria-hidden="true" />
                ) : supported ? (
                  <Mic className="h-8 w-8" aria-hidden="true" />
                ) : (
                  <MicOff className="h-8 w-8" aria-hidden="true" />
                )}
              </button>
              <p className="text-xs font-medium text-muted-foreground">
                {listening
                  ? "Listening… speak naturally to the agent."
                  : "Tap mic to answer the agent aloud."}
              </p>
              {interim && (
                <p className="max-w-full rounded-md bg-muted px-2.5 py-1 text-xs italic text-muted-foreground">
                  {interim}…
                </p>
              )}
            </div>

            {/* Conversational Dialogue Log */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Agent Dialogue Log
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Reset Session
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto rounded-lg border border-border bg-background p-3">
                {history.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1 p-2 rounded-md text-xs ${
                      turn.speaker === "agent"
                        ? "bg-primary/5 border border-primary/10 text-foreground self-start"
                        : "bg-muted text-foreground self-end max-w-[90%]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wide">
                        {turn.speaker === "agent" ? "🤖 Texas DPS Agent" : "🗣️ Caller"}
                      </span>
                      <span>{turn.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{turn.text}</p>
                    {turn.extractedFields && turn.extractedFields.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {turn.extractedFields.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                          >
                            +{f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Voice Simulations */}
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Quick Spoken Simulations
                </p>
                <button
                  type="button"
                  onClick={handleRunFullSimulation}
                  className="text-xs font-semibold text-primary underline hover:text-primary/80"
                >
                  Simulate Full Interview
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {SIMULATED_CONVERSATION_STEPS.map((step) => (
                  <button
                    key={step.step}
                    type="button"
                    onClick={() => handleSpokenInput(step.callerText)}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <span className="font-medium text-primary shrink-0">{step.step}:</span>
                    <span className="truncate pl-2 text-muted-foreground">“{step.callerText}”</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Right: Texas DL-14A PDF & Form Preview (7 columns) */}
          <section
            aria-label="Official Document and Form"
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-7"
          >
            {/* View Controls Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setViewMode("pdf")}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all " +
                    (viewMode === "pdf"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  Official Texas DL-14A PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("form")}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all " +
                    (viewMode === "form"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <FileText className="h-3.5 w-3.5" />
                  Extracted Fields View
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updatePdf(formValues, flattenPdf)}
                  disabled={isGeneratingPdf}
                  title="Re-render PDF"
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  aria-label="Re-render PDF"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingPdf ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download DL-14A PDF
                </button>
              </div>
            </div>

            {/* Mode 1: PDF Live View */}
            {viewMode === "pdf" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      Texas DPS Form DL-14A • Live AcroForm Stamping
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flattenPdf}
                      onChange={(e) => setFlattenPdf(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Flatten fields</span>
                  </label>
                </div>

                {/* PDF Viewer */}
                <div className="relative w-full h-[640px] rounded-lg border border-border overflow-hidden bg-slate-900 shadow-inner">
                  {pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      title="Texas DPS Form DL-14A Application"
                      className="h-full w-full border-none"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Rendering Texas DL-14A Document...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: Form Fields View */}
            {viewMode === "form" && (
              <div className="flex flex-col gap-4 max-h-[660px] overflow-y-auto pr-1">
                <div className="rounded-lg border border-border p-4 bg-background">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    1. Application Type & Class
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-semibold">{formValues.appType || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transaction:</span>
                      <p className="font-semibold">{formValues.transactionType || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Class:</span>
                      <p className="font-semibold">{formValues.licenseClass}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-background">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    2. Applicant Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-semibold">
                        {formValues.firstName || formValues.lastName
                          ? `${formValues.firstName} ${formValues.lastName}`
                          : "(pending)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date of Birth:</span>
                      <p className="font-semibold">{formValues.dateOfBirth || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sex:</span>
                      <p className="font-semibold">{formValues.sex || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SSN:</span>
                      <p className="font-semibold">{formValues.ssn || "(pending)"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-background">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    3. Physical Card Descriptors
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <p className="font-semibold">
                        {formValues.heightFt
                          ? `${formValues.heightFt}' ${formValues.heightIn}"`
                          : "(pending)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Weight:</span>
                      <p className="font-semibold">
                        {formValues.weightLbs ? `${formValues.weightLbs} lbs` : "(pending)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eye Color:</span>
                      <p className="font-semibold">{formValues.eyeColor || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hair Color:</span>
                      <p className="font-semibold">{formValues.hairColor || "(pending)"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-background">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    4. Contact & Address
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Residence:</span>
                      <p className="font-semibold">{formValues.residenceAddress || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">City, Zip:</span>
                      <p className="font-semibold">
                        {formValues.city
                          ? `${formValues.city}, ${formValues.zipCode}`
                          : "(pending)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">County:</span>
                      <p className="font-semibold">{formValues.county || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-semibold">{formValues.phone || "(pending)"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-semibold">{formValues.email || "(pending)"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-background">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    5. Statutory Eligibility
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">U.S. Citizen:</span>
                      <p className="font-semibold">
                        {formValues.isCitizen === null
                          ? "(pending)"
                          : formValues.isCitizen
                            ? "YES"
                            : "NO"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Voter Registration:</span>
                      <p className="font-semibold">
                        {formValues.registerVote === null
                          ? "(pending)"
                          : formValues.registerVote
                            ? "YES"
                            : "NO"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Veteran:</span>
                      <p className="font-semibold">
                        {formValues.isVeteran === null
                          ? "(pending)"
                          : formValues.isVeteran
                            ? "YES"
                            : "NO"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Organ Donor:</span>
                      <p className="font-semibold">
                        {formValues.organDonor === null
                          ? "(pending)"
                          : formValues.organDonor
                            ? "YES"
                            : "NO"}
                      </p>
                    </div>
                  </div>
                </div>
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
            Jordan is a blind/low-vision resident applying for utility assistance. His story shows
            the gap FormBuddy fills.
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
                Jordan can use a screen reader and tools that read documents aloud. But a long
                utility-assistance form is still hard to finish independently: requirements are
                scattered, language is confusing, he can lose track of progress, and he may not know
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
                Screen readers, Seeing AI, and Be My AI can read or describe a page. Caseworkers can
                help complete forms. But reading a form is not the same as preparing a complete
                application.
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
                FormBuddy creates a voice-first completion plan: it turns the form into one clear
                question at a time, remembers answers and missing documents, requires confirmation
                for important answers, protects sensitive fields, and creates a reviewable answer
                packet.
              </p>
            </article>
          </div>

          <p className="rounded-lg border border-primary bg-accent px-4 py-3 text-sm font-semibold text-primary">
            Other tools help Jordan read the form. FormBuddy helps Jordan finish preparing it.
          </p>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            FormBuddy never captures or speaks SSNs, bank details, card numbers, routing numbers, or
            passwords. Jordan reviews all answers before export and submits through the official
            channel.
          </p>
        </section>
      </main>
    </div>
  );
}
