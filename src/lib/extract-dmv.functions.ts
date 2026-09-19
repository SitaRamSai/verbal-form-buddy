import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const ExtractInput = z.object({
  transcript: z.string().min(1).max(4000),
  /** Fields already captured, so the model does not have to re-guess them. */
  known: z.record(z.string(), z.string()).optional(),
});

const ExtractedSchema = z.object({
  appType: z.string().nullable(),
  licenseClass: z.string().nullable(),
  transactionType: z.string().nullable(),
  firstName: z.string().nullable(),
  middleName: z.string().nullable(),
  lastName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  sex: z.string().nullable(),
  birthCity: z.string().nullable(),
  birthState: z.string().nullable(),
  heightFt: z.string().nullable(),
  heightIn: z.string().nullable(),
  weightLbs: z.string().nullable(),
  eyeColor: z.string().nullable(),
  hairColor: z.string().nullable(),
  residenceAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  county: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isCitizen: z.boolean().nullable(),
  registerVote: z.boolean().nullable(),
  isVeteran: z.boolean().nullable(),
  organDonor: z.boolean().nullable(),
});

const SYSTEM = `You extract answers for the Texas DL-14A Driver License / ID Card application from rambling, unedited speech-to-text. The speaker may wander, correct themselves, use filler words, and answer several fields in one breath.

Rules:
- Return a value only for fields the speaker clearly stated. Every other field must be null.
- Never invent, guess, or infer a value that was not said. Never echo the question back.
- If the speaker corrects themselves ("Lopez, sorry, Lopes"), keep the LAST version.
- Ignore filler ("uh", "um", "like", "I guess", "sorry"), greetings, and questions.
- dateOfBirth is mm/dd/yyyy. phone is (xxx) xxx-xxxx. Names are Title Case, no punctuation.
- heightFt, heightIn, weightLbs, zipCode are plain digits.
- state and birthState are two-letter codes. county is the county name only, without the word "County".
- appType is exactly "Driver License" or "Identification Card". transactionType is exactly "Original", "Renewal", "Replacement", or "Address or Name Change". licenseClass is a single letter. sex is "Male" or "Female".
- eyeColor and hairColor are single Title Case words.
- Speech artifacts: "at" can mean "@", "dot" can mean ".", spelled-out numbers become digits.
- Never extract a Social Security number; there is no field for it here.
- Booleans: true only for a clear yes, false only for a clear no, otherwise null.`;

export type DmvExtractResult = {
  values: Record<string, string | boolean>;
  error?: string;
};

export const extractDmvFields = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<DmvExtractResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { values: {}, error: "AI is not configured." };

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key, undefined, { structuredOutputs: true });

    const knownEntries = Object.entries(data.known ?? {}).filter(([, v]) => v);
    const knownBlock = knownEntries.length
      ? `Already captured (do not change these): ${knownEntries.map(([k, v]) => `${k}=${v}`).join(", ")}\n`
      : "";

    try {
      const result = streamText({
        model: gateway("google/gemini-3.8-flash"),
        system: SYSTEM,
        prompt: `${knownBlock}Speaker said: "${data.transcript}"`,
        output: Output.object({ schema: ExtractedSchema }),
      });

      const output = await result.output;
      const values: Record<string, string | boolean> = {};
      for (const [field, value] of Object.entries(output)) {
        if (typeof value === "string" && value.trim()) values[field] = value.trim();
        else if (typeof value === "boolean") values[field] = value;
      }
      return { values };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { values: {}, error: "The AI reply could not be read." };
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("402")) {
        return { values: {}, error: "AI credits are exhausted — add credits to continue." };
      }
      if (message.includes("429")) {
        return { values: {}, error: "AI is busy right now — try again in a moment." };
      }
      return { values: {}, error: "The AI could not be reached." };
    }
  });
