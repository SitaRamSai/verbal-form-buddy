import dmvSchema from "@/data/dmv-dl14a-schema.json";
import { normalizeNumberWords, formatSpokenDate } from "./form-parser";

export interface DmvFormValues {
  // Application Type
  appType: string;
  licenseClass: string;
  transactionType: string;

  // Personal Info
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  sex: string;
  ssn: string;
  birthCity: string;
  birthState: string;

  // Physical Attributes
  heightFt: string;
  heightIn: string;
  weightLbs: string;
  eyeColor: string;
  hairColor: string;
  race: string;
  ethnicity: string;

  // Contact Info
  residenceAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  phone: string;
  email: string;

  // Eligibility
  isCitizen: boolean | null;
  registerVote: boolean | null;
  isVeteran: boolean | null;
  organDonor: boolean | null;
}

export const EMPTY_DMV_FORM: DmvFormValues = {
  appType: "",
  licenseClass: "C",
  transactionType: "",
  firstName: "",
  lastName: "",
  middleName: "",
  dateOfBirth: "",
  sex: "",
  ssn: "",
  birthCity: "",
  birthState: "TX",
  heightFt: "",
  heightIn: "",
  weightLbs: "",
  eyeColor: "",
  hairColor: "",
  race: "",
  ethnicity: "",
  residenceAddress: "",
  city: "",
  state: "TX",
  zipCode: "",
  county: "",
  phone: "",
  email: "",
  isCitizen: null,
  registerVote: null,
  isVeteran: null,
  organDonor: null,
};

export interface AgentDialogueTurn {
  speaker: "agent" | "user";
  text: string;
  timestamp: string;
  extractedFields?: string[];
  decisionNote?: string;
}

export type InterviewStage =
  "GREETING_AND_TYPE" | "IDENTITY" | "PHYSICAL" | "CONTACT" | "ELIGIBILITY" | "COMPLETED";

export interface AgentDecisionResult {
  agentUtterance: string;
  updatedValues: DmvFormValues;
  newlyExtractedKeys: string[];
  nextStage: InterviewStage;
  isComplete: boolean;
  decisionReasoning: string;
}

/**
 * Autonomous Decision-Making Voice Agent for Texas DMV Form DL-14A.
 * Rather than a passive regex listener, this agent drives the conversation,
 * evaluates what information is collected vs missing, resolves multi-slot natural language,
 * and decides what to ask next.
 */
export class DmvVoiceAgent {
  public values: DmvFormValues;
  public history: AgentDialogueTurn[] = [];
  public currentStage: InterviewStage = "GREETING_AND_TYPE";
  /** Fields the user could not or would not answer; treated as satisfied so we move on. */
  private skipped = new Set<string>();
  /** Which fields the last question targeted, and how many times we've asked about them. */
  private lastTargets: string[] = [];
  private askCount = 0;

  constructor(initialValues?: Partial<DmvFormValues>) {
    this.values = { ...EMPTY_DMV_FORM, ...(initialValues || {}) };
  }

  public getInitialGreeting(): string {
    const greeting =
      "Hello! I am your Texas DPS Driver License Assistant. I've analyzed Form DL-14A and I'll help you complete your application. To begin, are you applying for a Driver License or an ID Card, and is this an original application or a renewal?";
    this.history.push({
      speaker: "agent",
      text: greeting,
      timestamp: new Date().toLocaleTimeString(),
      decisionNote: "Initiated interview; driving towards Application Type & Transaction",
    });
    return greeting;
  }

  /**
   * Main Decision Loop:
   * 1. Evaluates user spoken input against target schema.
   * 2. Extracts single or multiple slots.
   * 3. Calculates remaining requirements.
   * 4. Decides next question or finalization action.
   */
  public processSpokenInput(spokenText: string): AgentDecisionResult {
    const text = spokenText.trim();
    const normalized = normalizeNumberWords(text);
    const extracted: Partial<DmvFormValues> = {};
    const extractedKeyList: string[] = [];

    // --- 1. Natural Language Slot Extractor ---

    // Application Type
    if (/\b(?:driver'?s?\s*license|dl)\b/i.test(text)) {
      extracted.appType = "Driver License";
      extractedKeyList.push("appType");
    } else if (/\b(?:identification|id\s*card|state\s*id)\b/i.test(text)) {
      extracted.appType = "Identification Card";
      extractedKeyList.push("appType");
    }

    // Transaction Type
    if (/\b(?:original|first\s*time|new\s*(?:license|application))\b/i.test(text)) {
      extracted.transactionType = "Original";
      extractedKeyList.push("transactionType");
    } else if (/\b(?:renew(?:al)?)\b/i.test(text)) {
      extracted.transactionType = "Renewal";
      extractedKeyList.push("transactionType");
    } else if (/\b(?:replace(?:ment)?|lost|stolen)\b/i.test(text)) {
      extracted.transactionType = "Replacement";
      extractedKeyList.push("transactionType");
    } else if (/\b(?:change\s*of\s*address|address\s*change)\b/i.test(text)) {
      extracted.transactionType = "Address or Name Change";
      extractedKeyList.push("transactionType");
    }

    // Class
    const classMatch = text.match(/\bclass\s*([abc])\b/i);
    if (classMatch) {
      extracted.licenseClass = classMatch[1]!.toUpperCase();
      extractedKeyList.push("licenseClass");
    }

    // Name Extraction (only if not already captured)
    if (!this.values.firstName || !this.values.lastName) {
      const nameMatch =
        text.match(
          /(?:my\s+)?(?:full\s+)?name\s+is\s+([A-Za-z\s]+?)(?:[,.]|\s+(?:born|and|i|my|dob)\b|$)/i,
        ) || text.match(/\bi\s+am\s+(?!a\b|an\b|not\b|applying\b)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
      if (nameMatch) {
        const parts = nameMatch[1]!.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2 && !/\b(?:citizen|veteran|donor|license)\b/i.test(nameMatch[1]!)) {
          extracted.firstName = parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1);
          extracted.lastName =
            parts[parts.length - 1]!.charAt(0).toUpperCase() + parts[parts.length - 1]!.slice(1);
          if (parts.length > 2) {
            extracted.middleName = parts.slice(1, -1).join(" ");
          }
          extractedKeyList.push("firstName", "lastName");
        }
      }
    }

    // Date of Birth
    const dobFormatted = formatSpokenDate(text);
    if (dobFormatted) {
      extracted.dateOfBirth = dobFormatted;
      extractedKeyList.push("dateOfBirth");
    }

    // Sex
    if (/\b(?:female|woman)\b/i.test(text)) {
      extracted.sex = "Female";
      extractedKeyList.push("sex");
    } else if (/\b(?:male|man)\b/i.test(text)) {
      extracted.sex = "Male";
      extractedKeyList.push("sex");
    }

    // SSN
    const ssnMatch =
      normalized.match(/(?:ssn|social\s+security)(?:\s+number)?\s+(?:is\s+)?([\d\s-]{9,11})/i) ||
      normalized.match(/\b(\d{3}\s*\d{2}\s*\d{4})\b/);
    if (ssnMatch) {
      const digits = ssnMatch[1]!.replace(/\D/g, "");
      if (digits.length === 9) {
        extracted.ssn = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
        extractedKeyList.push("ssn");
      }
    }

    // Height
    const heightMatch = normalized.match(
      /(\d+)\s*(?:foot|feet|ft)\s*(?:and\s*)?(\d+)?\s*(?:inches|inch|in)?/i,
    );
    if (heightMatch) {
      extracted.heightFt = heightMatch[1]!;
      extracted.heightIn = heightMatch[2] || "0";
      extractedKeyList.push("heightFt", "heightIn");
    }

    // Weight
    const weightMatch = normalized.match(/(\d{2,3})\s*(?:pounds|lbs|pound)/i);
    if (weightMatch) {
      extracted.weightLbs = weightMatch[1]!;
      extractedKeyList.push("weightLbs");
    }

    // Eye Color
    const eyeMatch =
      text.match(/\b(blue|brown|gray|hazel|green|black|maroon|pink)\s*eyes?\b/i) ||
      text.match(/eye\s*color\s*(?:is\s*)?(blue|brown|gray|hazel|green|black|maroon|pink)/i);
    if (eyeMatch) {
      extracted.eyeColor =
        eyeMatch[1]!.charAt(0).toUpperCase() + eyeMatch[1]!.slice(1).toLowerCase();
      extractedKeyList.push("eyeColor");
    }

    // Hair Color
    const hairMatch =
      text.match(/\b(black|red|gray|brown|blonde|bald|white)\s*hair\b/i) ||
      text.match(/hair\s*color\s*(?:is\s*)?(black|red|gray|brown|blonde|bald|white)/i);
    if (hairMatch) {
      extracted.hairColor =
        hairMatch[1]!.charAt(0).toUpperCase() + hairMatch[1]!.slice(1).toLowerCase();
      extractedKeyList.push("hairColor");
    }

    // Address
    const addressMatch = text.match(/(?:i\s+live\s+at|address\s+is|residence\s+is)\s+([^.,;]+)/i);
    if (addressMatch) {
      let addr = addressMatch[1]!.trim();
      addr = addr.split(/\s+(?:in\s+(?:the\s+city\s+of)?|city\s+of|,)\b/i)[0]!.trim();
      extracted.residenceAddress = addr;
      extractedKeyList.push("residenceAddress");
    }

    // City & County
    const cityMatch =
      text.match(/\bcity\s+of\s+([A-Za-z\s]+?)(?:,\s*|\s+zip|\s+in|\s+texas|$)/i) ||
      text.match(/\bin\s+([A-Za-z\s]+?),\s*(?:tx|texas)/i) ||
      text.match(/,\s*([A-Za-z\s]+?),\s*(?:tx|texas)/i);
    if (cityMatch) {
      extracted.city = cityMatch[1]!.trim();
      extractedKeyList.push("city");
    }

    const countyMatch = text.match(/([A-Za-z]+)\s+county/i);
    if (countyMatch) {
      extracted.county =
        countyMatch[1]!.charAt(0).toUpperCase() + countyMatch[1]!.slice(1).toLowerCase();
      extractedKeyList.push("county");
    }

    // Zip Code
    const zipMatch = normalized.match(/\b(?:zip|zip\s*code)?\s*(\d{5})\b/);
    if (zipMatch) {
      extracted.zipCode = zipMatch[1]!;
      extractedKeyList.push("zipCode");
    }

    // Phone
    const phoneMatch = normalized.match(/(?:phone|call|cell)\s*(?:is|at)?\s*([\d\s-]{10,14})/i);
    if (phoneMatch) {
      const digits = phoneMatch[1]!.replace(/\D/g, "");
      if (digits.length === 10) {
        extracted.phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        extractedKeyList.push("phone");
      }
    }

    // Email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      extracted.email = emailMatch[1]!.toLowerCase();
      extractedKeyList.push("email");
    } else {
      // Spoken email: "carlos dot rodriguez at example dot com"
      const spokenEmail = text.match(
        /([a-zA-Z0-9]+(?:\s+dot\s+[a-zA-Z0-9]+)*\s+at\s+[a-zA-Z0-9]+(?:\s+dot\s+[a-zA-Z0-9]+)+)/i,
      );
      if (spokenEmail) {
        extracted.email = spokenEmail[1]!
          .replace(/\s+at\s+/gi, "@")
          .replace(/\s+dot\s+/gi, ".")
          .replace(/\s+/g, "")
          .toLowerCase();
        extractedKeyList.push("email");
      }
    }

    // Eligibility Booleans parsed per clause to prevent cross-clause negative leakage
    const clauses = text.split(/[,;]|\band\b/i).map((c) => c.trim());
    for (const clause of clauses) {
      if (/\b(?:citizen|us\s*citizen)\b/i.test(clause)) {
        extracted.isCitizen = !/\b(?:no|not|non)\b/i.test(clause);
        extractedKeyList.push("isCitizen");
      }
      if (/\b(?:register(?:\s+\w+)?\s+to\s+vote|voter)\b/i.test(clause)) {
        extracted.registerVote = !/\b(?:no|don'?t|not)\b/i.test(clause);
        extractedKeyList.push("registerVote");
      }
      if (/\b(?:veteran)\b/i.test(clause)) {
        extracted.isVeteran = !/\b(?:no|not|non)\b/i.test(clause);
        extractedKeyList.push("isVeteran");
      }
      if (/\b(?:organ\s*donor|donor)\b/i.test(clause)) {
        extracted.organDonor = !/\b(?:no|don'?t|not)\b/i.test(clause);
        extractedKeyList.push("organDonor");
      }
    }

    // Merge extracted values
    this.values = { ...this.values, ...extracted };

    // Log User Turn
    this.history.push({
      speaker: "user",
      text,
      timestamp: new Date().toLocaleTimeString(),
      extractedFields: extractedKeyList,
    });

    return this.decide(extractedKeyList);
  }

  /**
   * Merges values produced by the AI extractor, filling only fields the rules left empty,
   * then re-runs the decision loop so the next question reflects everything captured.
   */
  public applyExtractedValues(partial: Record<string, unknown>): AgentDecisionResult {
    const filled: string[] = [];
    for (const [key, raw] of Object.entries(partial)) {
      if (!(key in this.values)) continue;
      const field = key as keyof DmvFormValues;
      const current = this.values[field];
      if (typeof raw === "string") {
        const value = raw.trim();
        if (value && !current) {
          (this.values as unknown as Record<string, unknown>)[field] = value;
          filled.push(field);
        }
      } else if (typeof raw === "boolean" && current === null) {
        (this.values as unknown as Record<string, unknown>)[field] = raw;
        filled.push(field);
      }
    }

    // Replace the agent turn produced by the rules pass so the log shows one question.
    if (this.history.length > 0 && this.history[this.history.length - 1]!.speaker === "agent") {
      this.history.pop();
    }
    const lastUserTurn = [...this.history].reverse().find((t) => t.speaker === "user");
    if (lastUserTurn && filled.length > 0) {
      lastUserTurn.extractedFields = Array.from(
        new Set([...(lastUserTurn.extractedFields ?? []), ...filled]),
      );
    }

    return this.decide(filled);
  }

  /**
   * Seeds the form from the "About you" card the user typed once, then re-runs the
   * decision loop so the agent only asks about what is still missing.
   */
  public seedProfile(profile: Record<string, string>): AgentDecisionResult {
    const filled: string[] = [];
    for (const [key, raw] of Object.entries(profile)) {
      if (!(key in this.values)) continue;
      const value = (raw ?? "").trim();
      if (!value) continue;
      (this.values as unknown as Record<string, unknown>)[key] = value;
      filled.push(key);
    }

    this.history.push({
      speaker: "user",
      text: "Here are my basic details (entered on the About you card).",
      timestamp: new Date().toLocaleTimeString(),
      extractedFields: filled,
    });

    return this.decide(filled);
  }


  /** Decides what to ask next based on everything captured so far. */
  private decide(extractedKeyList: string[]): AgentDecisionResult {
    // --- 2. Autonomous Decision Strategy ---
    let agentUtterance = "";
    let decisionReasoning = "";
    let nextStage: InterviewStage = this.currentStage;
    let isComplete = false;


    // Evaluate Stage Progression
    const hasAppType = !!(this.values.appType && this.values.transactionType);
    const hasIdentity = !!(
      this.values.firstName &&
      this.values.lastName &&
      this.values.dateOfBirth &&
      this.values.sex
    );
    const hasPhysical = !!(
      this.values.heightFt &&
      this.values.weightLbs &&
      this.values.eyeColor &&
      this.values.hairColor
    );
    const hasContact = !!(
      this.values.residenceAddress &&
      this.values.city &&
      this.values.zipCode &&
      this.values.phone
    );
    const hasEligibility = this.values.isCitizen !== null && this.values.organDonor !== null;

    if (!hasAppType) {
      nextStage = "GREETING_AND_TYPE";
      agentUtterance =
        "Are you applying for a Driver License or an ID Card, and is it an original application or renewal?";
      decisionReasoning =
        "Application Type / Transaction missing; prompting for target credential.";
    } else if (!hasIdentity) {
      nextStage = "IDENTITY";
      if (!this.values.firstName || !this.values.lastName) {
        agentUtterance = `Got it, a ${this.values.transactionType} ${this.values.appType}. What is your legal first and last name?`;
        decisionReasoning = "Name not yet captured; requesting legal name.";
      } else if (!this.values.dateOfBirth) {
        agentUtterance = `Thanks, ${this.values.firstName}. What is your date of birth, and biological sex?`;
        decisionReasoning = "Name captured; requesting Date of Birth and Sex.";
      } else {
        agentUtterance = `Thank you. What is your biological sex (Male or Female)?`;
        decisionReasoning = "Sex missing; asking for sex designation.";
      }
    } else if (!hasPhysical) {
      nextStage = "PHYSICAL";
      const missingPhysical = [];
      if (!this.values.heightFt) missingPhysical.push("height in feet and inches");
      if (!this.values.weightLbs) missingPhysical.push("approximate weight in pounds");
      if (!this.values.eyeColor) missingPhysical.push("eye color");
      if (!this.values.hairColor) missingPhysical.push("hair color");

      agentUtterance = `Next, for your physical description on the card: could you share your ${missingPhysical.join(", ")}?`;
      decisionReasoning = `Physical attributes missing (${missingPhysical.join(", ")}); prompting for card descriptors.`;
    } else if (!hasContact) {
      nextStage = "CONTACT";
      const missingContact = [];
      if (!this.values.residenceAddress) missingContact.push("residential street address");
      if (!this.values.city) missingContact.push("city");
      if (!this.values.zipCode) missingContact.push("zip code");
      if (!this.values.phone) missingContact.push("contact phone number");

      agentUtterance = `Great. What is your Texas residential address (including street, city, and zip code), and your primary phone number?`;
      decisionReasoning = `Contact/address missing; driving towards residence and phone.`;
    } else if (!hasEligibility) {
      nextStage = "ELIGIBILITY";
      agentUtterance = `Almost finished! Texas DPS requires these final statutory questions: Are you a U.S. citizen? Would you like to register to vote? And would you like to register as an organ donor with Donate Life Texas?`;
      decisionReasoning =
        "Eligibility and statutory questions pending; asking citizen, voting, and donor questions.";
    } else {
      nextStage = "COMPLETED";
      isComplete = true;
      agentUtterance = `All required sections for Form DL-14A are complete! I have verified your personal information, physical descriptors, Texas address, and statutory answers. Your official Texas DPS Driver License application is ready for signature and PDF download.`;
      decisionReasoning = "All 29 keys satisfied. Form is complete and sealed.";
    }

    this.currentStage = nextStage;

    // Log Agent Turn
    this.history.push({
      speaker: "agent",
      text: agentUtterance,
      timestamp: new Date().toLocaleTimeString(),
      decisionNote: decisionReasoning,
    });

    return {
      agentUtterance,
      updatedValues: this.values,
      newlyExtractedKeys: extractedKeyList,
      nextStage,
      isComplete,
      decisionReasoning,
    };
  }

  /**
   * Helper to count total filled vs target keys.
   */
  public getProgress(): { filled: number; total: number; percentage: number } {
    let filled = 0;
    const allFields = dmvSchema.sections.flatMap((s) => s.fields);
    const total = allFields.length;

    for (const f of allFields) {
      const val = (this.values as unknown as Record<string, unknown>)[f.key];
      if (val !== undefined && val !== "" && val !== null) {
        filled++;
      }
    }

    return {
      filled,
      total,
      percentage: Math.round((filled / total) * 100),
    };
  }
}
