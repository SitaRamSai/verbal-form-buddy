// Pure, client-safe helpers that turn spoken sentences into form values.
// Target form: Texas Driver License / ID Card Application (Form DL-14A).

export interface FormValues {
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  ssn: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  placeOfBirthCity: string;
  placeOfBirthState: string;
  fathersLastName: string;
  mothersMaidenName: string;
  residenceAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  phone: string;
  cellPhone: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyAddress: string;
}

export const EMPTY_FORM: FormValues = {
  lastName: "",
  firstName: "",
  middleName: "",
  dateOfBirth: "",
  ssn: "",
  heightFeet: "",
  heightInches: "",
  weight: "",
  placeOfBirthCity: "",
  placeOfBirthState: "",
  fathersLastName: "",
  mothersMaidenName: "",
  residenceAddress: "",
  city: "",
  state: "",
  zipCode: "",
  county: "",
  phone: "",
  cellPhone: "",
  email: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyAddress: "",
};

export const FIELD_LABELS: Record<keyof FormValues, string> = {
  lastName: "Last name",
  firstName: "First name",
  middleName: "Middle name",
  dateOfBirth: "Date of birth",
  ssn: "Social Security number",
  heightFeet: "Height (feet)",
  heightInches: "Height (inches)",
  weight: "Weight",
  placeOfBirthCity: "Place of birth — city",
  placeOfBirthState: "Place of birth — state",
  fathersLastName: "Father's last name",
  mothersMaidenName: "Mother's maiden name",
  residenceAddress: "Residence address",
  city: "City",
  state: "State",
  zipCode: "ZIP code",
  county: "County",
  phone: "Primary phone",
  cellPhone: "Cellular phone",
  email: "Email",
  emergencyName: "Emergency contact name",
  emergencyPhone: "Emergency contact phone",
  emergencyAddress: "Emergency contact address",
};

// --- number words -> digits -------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100,
};

// Ordinals are replaced with digits before number-word parsing so a spoken
// day ("fifth") never merges into the year ("nineteen eighty five" -> 1985).
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11,
  twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30,
  "twenty first": 21, "twenty second": 22, "twenty third": 23,
  "twenty fourth": 24, "twenty fifth": 25, "twenty sixth": 26,
  "twenty seventh": 27, "twenty eighth": 28, "twenty ninth": 29,
  "thirty first": 31,
};

// "five five five one two" -> "55512"; "twenty five" -> "25";
// "nineteen eighty five" -> "1985"; "twelve hundred" -> "1200".
export function normalizeNumberWords(input: string): string {
  let prepared = ` ${input.toLowerCase().replace(/-/g, " ")} `;
  for (const phrase of Object.keys(ORDINALS).sort((a, b) => b.length - a.length)) {
    prepared = prepared.replace(
      new RegExp(`\\b${phrase}\\b`, "g"),
      ` ${ORDINALS[phrase]} `
    );
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
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS);

const pad = (n: number) => String(n).padStart(2, "0");

/** Returns the date as mm/dd/yyyy, which is what the DL-14A expects. */
export function formatSpokenDate(raw: string): string | null {
  const text = normalizeNumberWords(raw);
  const monthMatch = MONTH_NAMES.find((m) => new RegExp(`\\b${m}\\b`).test(text));

  if (!monthMatch) {
    // Numeric forms: "01/05/1985", "1 5 1985".
    const numbers = (text.match(/\d+/g) ?? []).map(Number);
    if (numbers.length < 3) return null;
    const [m, d, y] = numbers as [number, number, number];
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
    return `${pad(m)}/${pad(d)}/${y}`;
  }

  const withoutMonth = text.replace(new RegExp(`\\b${monthMatch}\\b`), " ").trim();
  const numbers = (withoutMonth.match(/\d+/g) ?? []).map(Number);
  const month = MONTHS[monthMatch]!;
  let day: number | null = null;
  let year: number | null = null;
  for (const n of numbers) {
    if (n > 31 && year === null) year = n;
    else if (n >= 1 && n <= 31 && day === null) day = n;
  }
  if (day === null || year === null) return null;
  return `${pad(month)}/${pad(day)}/${year}`;
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
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
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

function splitName(full: string): Partial<FormValues> | null {
  const parts = cleanName(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { firstName: parts[0]! };
  if (parts.length === 2) return { firstName: parts[0]!, lastName: parts[1]! };
  return {
    firstName: parts[0]!,
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

// --- field extraction -------------------------------------------------------

interface FieldRule {
  patterns: RegExp[];
  /** Turns the captured text into one or more field values. */
  apply: (value: string) => Partial<FormValues> | null;
}

const text = (v: string) => v.replace(/\s+/g, " ").trim();

const RULES: FieldRule[] = [
  {
    patterns: [
      /(?:my\s+)?(?:full\s+)?name\s+is\s+([^.,!?;]+)/i,
      /\bi\s+am\s+called\s+([^.,!?;]+)/i,
    ],
    apply: splitName,
  },
  {
    patterns: [/last\s+name\s+is\s+([^.,!?;]+)/i],
    apply: (v) => ({ lastName: cleanName(v) }),
  },
  {
    patterns: [/first\s+name\s+is\s+([^.,!?;]+)/i],
    apply: (v) => ({ firstName: cleanName(v) }),
  },
  {
    patterns: [/middle\s+name\s+is\s+([^.,!?;]+)/i],
    apply: (v) => ({ middleName: cleanName(v) }),
  },
  {
    patterns: [
      /(?:date\s+of\s+birth|d\.?o\.?b\.?|birthday)\s+(?:is\s+|on\s+)?([^.,!?;]+)/i,
      /(?:i\s+was\s+)?born\s+on\s+([^.,!?;]+)/i,
    ],
    apply: (v) => {
      const d = formatSpokenDate(v);
      return d ? { dateOfBirth: d } : null;
    },
  },
  {
    patterns: [
      /(?:social\s+security(?:\s+number)?|ssn)\s+(?:is\s+)?([\d\s-]+)/i,
    ],
    apply: (v) => {
      const digits = v.replace(/\D/g, "");
      if (digits.length !== 9) return null;
      return {
        ssn: `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`,
      };
    },
  },
  {
    patterns: [
      /(?:height\s+is\s+|i\s+am\s+|i'?m\s+)?(\d{1})\s*(?:foot|feet|ft)\s*(\d{1,2})?\s*(?:inch|inches|in)?/i,
    ],
    apply: (v) => {
      const nums = v.match(/\d+/g) ?? [];
      const feet = Number(nums[0]);
      if (!(feet >= 3 && feet <= 8)) return null;
      const inches = nums[1] !== undefined ? Number(nums[1]) : null;
      return {
        heightFeet: String(feet),
        ...(inches !== null && inches >= 0 && inches < 12
          ? { heightInches: String(inches) }
          : {}),
      };
    },
  },
  {
    patterns: [
      /(?:i\s+weigh|my\s+weight\s+is|weight\s+is|weigh)\s+(?:about\s+|around\s+)?(\d{2,3})/i,
    ],
    apply: (v) => {
      const n = Number(v.replace(/\D/g, ""));
      return n >= 40 && n <= 700 ? { weight: String(n) } : null;
    },
  },
  {
    patterns: [
      /(?:place\s+of\s+birth\s+is|i\s+was\s+born\s+in|born\s+in)\s+([^.,!?;]+)/i,
    ],
    apply: (v) => {
      const parts = text(v).split(/\s+(?:comma|in)\s+/i);
      const city = cleanName(parts[0] ?? "");
      if (!city) return null;
      const st = parts[1] ? cleanName(parts[1]) : "";
      return { placeOfBirthCity: city, ...(st ? { placeOfBirthState: st } : {}) };
    },
  },
  {
    patterns: [/father'?s?\s+last\s+name\s+(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => ({ fathersLastName: cleanName(v) }),
  },
  {
    patterns: [/mother'?s?\s+maiden\s+name\s+(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => ({ mothersMaidenName: cleanName(v) }),
  },
  {
    patterns: [
      /(?:my\s+address\s+is|i\s+live\s+at|residence\s+address\s+is|address\s+is|living\s+at)\s+([^.,!?;]+)/i,
    ],
    apply: (v) => ({ residenceAddress: text(v) }),
  },
  {
    patterns: [/(?:my\s+city\s+is|city\s+is|i\s+live\s+in)\s+([^.,!?;]+)/i],
    apply: (v) => ({ city: cleanName(v) }),
  },
  {
    patterns: [/(?:my\s+)?state\s+is\s+([^.,!?;]+)/i],
    apply: (v) => ({ state: cleanName(v) }),
  },
  {
    patterns: [/zip(?:\s+code)?\s+(?:is\s+)?([\d\s]{5,})/i],
    apply: (v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 5 ? { zipCode: digits.slice(0, 5) } : null;
    },
  },
  {
    patterns: [/county\s+(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => ({ county: cleanName(v) }),
  },
  {
    patterns: [/(?:cell(?:ular)?|mobile)\s*(?:phone)?(?:\s+number)?\s+(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => {
      const p = cleanPhone(v);
      return p ? { cellPhone: p } : null;
    },
  },
  {
    patterns: [
      /(?:primary\s+)?phone(?:\s+number)?\s+(?:is\s+)?([^.,!?;]+)/i,
      /(?:reach|call)\s+(?:me\s+)?at\s+([^.,!?;]+)/i,
    ],
    apply: (v) => {
      const p = cleanPhone(v);
      return p ? { phone: p } : null;
    },
  },
  {
    patterns: [/e-?mail(?:\s+address)?\s+(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => {
      const e = cleanEmail(v);
      return e ? { email: e } : null;
    },
  },
  {
    patterns: [/emergency\s+contact\s+(?:name\s+)?(?:is\s+)?([^.,!?;]+)/i],
    apply: (v) => ({ emergencyName: cleanName(v) }),
  },
];

export function parseTranscript(transcript: string): Partial<FormValues> {
  const normalized = normalizeNumberWords(transcript);
  const filled: Partial<FormValues> = {};
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;
      const values = rule.apply(match[1] ?? match[0] ?? "");
      if (values) {
        for (const [key, value] of Object.entries(values)) {
          if (value && !filled[key as keyof FormValues]) {
            filled[key as keyof FormValues] = value;
          }
        }
        break;
      }
    }
  }
  return filled;
}

// --- voice commands ---------------------------------------------------------

export type VoiceCommand = "repeat" | "why" | "save" | "documents";

export function detectCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase();
  if (/\bwhat documents?\b|\bdocuments? do i need\b/.test(t)) return "documents";
  if (/\bwhy do (they|you) need\b|\bwhy (is|do you need) (this|it)\b/.test(t)) return "why";
  if (/\bsave\b.*\b(later|this|it)\b|\bsave it\b/.test(t)) return "save";
  if (/\brepeat\b|\bsay that again\b|\bcome again\b/.test(t)) return "repeat";
  return null;
}
