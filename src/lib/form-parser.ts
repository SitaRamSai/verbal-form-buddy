// Pure, client-safe helpers that turn spoken sentences into form values.

export interface FormValues {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  householdSize: string;
  monthlyIncome: string;
  utilityProvider: string;
  accountNumber: string;
}

export const EMPTY_FORM: FormValues = {
  fullName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  householdSize: "",
  monthlyIncome: "",
  utilityProvider: "",
  accountNumber: "",
};

export const FIELD_LABELS: Record<keyof FormValues, string> = {
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  phone: "Phone number",
  email: "Email",
  address: "Home address",
  householdSize: "Household size",
  monthlyIncome: "Monthly income",
  utilityProvider: "Utility provider",
  accountNumber: "Account number",
};

// --- number words -> digits -------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

// Ordinals are replaced with digits before number-word parsing so a spoken
// day ("fifth") never merges into the year ("nineteen eighty five" -> 1985).
const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  "twenty first": 21,
  "twenty second": 22,
  "twenty third": 23,
  "twenty fourth": 24,
  "twenty fifth": 25,
  "twenty sixth": 26,
  "twenty seventh": 27,
  "twenty eighth": 28,
  "twenty ninth": 29,
  "thirty first": 31,
};

// "five five five one two" -> "55512"; "twenty five" -> "25";
// "nineteen eighty five" -> "1985"; "twelve hundred" -> "1200".
export function normalizeNumberWords(input: string): string {
  let prepared = ` ${input.toLowerCase().replace(/-/g, " ")} `;
  for (const phrase of Object.keys(ORDINALS).sort((a, b) => b.length - a.length)) {
    prepared = prepared.replace(new RegExp(`\\b${phrase}\\b`, "g"), ` ${ORDINALS[phrase]} `);
  }
  const tokens = prepared.trim().split(/\s+/);
  const out: string[] = [];
  let run: number[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    const groups: number[] = [];
    for (let i = 0; i < run.length; i++) {
      const value = run[i] ?? 0;
      if (value === 100 && groups.length > 0) {
        groups[groups.length - 1] = (groups[groups.length - 1] ?? 0) * 100;
      } else if (value >= 20 && (run[i + 1] ?? -1) > 0 && (run[i + 1] ?? -1) < 10) {
        groups.push(value + (run[i + 1] ?? 0));
        i++;
      } else {
        groups.push(value);
      }
    }
    out.push(groups.map((g) => String(g)).join(""));
    run = [];
  };

  for (const raw of tokens) {
    const token = raw.replace(/[^a-z0-9]/g, "");
    if (token in SMALL && typeof SMALL[token] === "number") {
      run.push(SMALL[token]!);
    } else if (/^\d+$/.test(token)) {
      flushRun();
      out.push(token);
    } else {
      flushRun();
      out.push(raw);
    }
  }
  flushRun();
  return out.join(" ");
}

// --- date parsing -----------------------------------------------------------

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS);

export function formatSpokenDate(raw: string): string | null {
  const text = normalizeNumberWords(raw);
  const monthMatch = MONTH_NAMES.find((m) => new RegExp(`\\b${m}\\b`).test(text));
  if (!monthMatch) return null;
  const withoutMonth = text.replace(new RegExp(`\\b${monthMatch}\\b`), " ").trim();
  const numbers = (withoutMonth.match(/\d+/g) ?? []).map(Number);
  const month = MONTHS[monthMatch];
  let day: number | null = null;
  let year: number | null = null;
  for (const n of numbers) {
    if (n > 31 && year === null) year = n;
    else if (n >= 1 && n <= 31 && day === null) day = n;
  }
  if (day === null) return null;
  const pretty = `${monthMatch.charAt(0).toUpperCase()}${monthMatch.slice(1)} ${day}`;
  return year !== null ? `${pretty}, ${year}` : pretty;
}

// --- value cleaners ---------------------------------------------------------

function cleanName(value: string): string {
  // Stop before the speaker starts describing another field.
  const trimmed = value.split(/\s+(?:and|also|then)\s+(?:my|the|our|it|i)\b/i)[0] ?? "";
  const connectives = new Set(["and", "of", "the", "de", "jr", "sr"]);
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && connectives.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanPhone(value: string): string | null {
  const digits = normalizeNumberWords(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function cleanEmail(value: string): string | null {
  const text = value
    .replace(/\s+at\s+/gi, " @ ")
    .replace(/\s+dot\s+/gi, " . ")
    .replace(/\s+underscore\s+/gi, " _ ")
    .replace(/\s+/g, "")
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
}

function cleanAddress(value: string): string {
  const trimmed = value.split(/\s+(?:and|also|then)\s+(?:my|the|our|it|i)\b/i)[0] ?? "";
  return trimmed
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[a-z]{2}$/i.test(word)) return word.toUpperCase();
      if (/^(?:apt|ste|unit|po|box)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// --- field extraction -------------------------------------------------------

interface FieldRule {
  field: keyof FormValues;
  patterns: RegExp[];
  clean: (value: string) => string | null;
}

const RULES: FieldRule[] = [
  {
    field: "fullName",
    patterns: [/(?:my\s+)?(?:full\s+)?name\s+is\s+([^.,!?;]+)/i],
    clean: cleanName,
  },
  {
    field: "phone",
    patterns: [
      /(?:phone|mobile|cell)(?:\s+number)?\s+(?:is\s+)?([^.,!?;]+)/i,
      /(?:reach|call)\s+(?:me\s+)?at\s+([^.,!?;]+)/i,
    ],
    clean: cleanPhone,
  },
  {
    field: "email",
    patterns: [/e-?mail(?:\s+address)?\s+(?:is\s+)?([^.,!?;]+)/i],
    clean: cleanEmail,
  },
  {
    field: "dateOfBirth",
    patterns: [
      /(?:date\s+of\s+birth|d\.?o\.?b\.?|birthday)\s+(?:is\s+|on\s+)?([^.,!?;]+)/i,
      /(?:i\s+was\s+)?born\s+(?:on\s+|in\s+)?([^.,!?;]+)/i,
    ],
    clean: (v) => formatSpokenDate(v),
  },
  {
    field: "address",
    patterns: [/(?:my\s+address\s+is|i\s+live\s+at|address\s+is|living\s+at)\s+([^.,!?;]+)/i],
    clean: cleanAddress,
  },
  {
    field: "householdSize",
    patterns: [
      /(?:household\s+size|household|family)\s+(?:size\s+)?(?:is\s+|of\s+)?(\d+)/i,
      /(?:there\s+are\s+)?(\d+)\s+(?:people|persons|members)/i,
    ],
    clean: (v) => {
      const n = Number(v);
      return n >= 1 && n <= 20 ? String(n) : null;
    },
  },
  {
    field: "monthlyIncome",
    patterns: [
      /(?:monthly\s+income|income)\s+(?:is\s+)?(?:about\s+|around\s+|roughly\s+)?\$?\s*([\d,]+)/i,
      /i\s+(?:make|earn)\s+(?:about\s+|around\s+|roughly\s+)?\$?\s*([\d,]+)/i,
    ],
    clean: (v) => {
      const n = Number(v.replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString("en-US")}` : null;
    },
  },
  {
    field: "utilityProvider",
    patterns: [
      /(?:utility\s+provider|utility\s+company|provider|company)\s+(?:is\s+)?([^.,!?;]+)/i,
    ],
    clean: (v) => cleanName(v),
  },
  {
    field: "accountNumber",
    patterns: [/(?:account\s+number|account)\s+(?:is\s+)?([\d\s]+)/i],
    clean: (v) => {
      const digits = normalizeNumberWords(v).replace(/\D/g, "");
      return digits.length >= 4 && digits.length <= 20 ? digits : null;
    },
  },
];

export function parseTranscript(transcript: string): Partial<FormValues> {
  const normalized = normalizeNumberWords(transcript);
  const filled: Partial<FormValues> = {};
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;
      const value = rule.clean(match[1] ?? "");
      if (value) {
        filled[rule.field] = value;
        break;
      }
    }
  }
  return filled;
}

// --- voice commands ---------------------------------------------------------

export type VoiceCommand = "repeat" | "why" | "save" | "documents" | "pdf";

export function detectCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase();
  if (/\b(show|open|view|see|download)\b.*\bpdf\b|\bpdf (form|view|application)\b/.test(t))
    return "pdf";
  if (/\bwhat documents?\b|\bdocuments? do i need\b/.test(t)) return "documents";
  if (/\bwhy do (they|you) need\b|\bwhy (is|do you need) (this|it)\b/.test(t)) return "why";
  if (/\bsave\b.*\b(later|this|it)\b|\bsave it\b/.test(t)) return "save";
  if (/\brepeat\b|\bsay that again\b|\bcome again\b/.test(t)) return "repeat";
  return null;
}
