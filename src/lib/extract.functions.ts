import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { EMPTY_FORM, FIELD_LABELS, type FormValues } from "@/lib/form-parser";

const FIELD_KEYS = Object.keys(EMPTY_FORM) as (keyof FormValues)[];

const ExtractInput = z.object({
  transcript: z.string().min(1).max(2000),
});

const shape = Object.fromEntries(
  FIELD_KEYS.map((key) => [key, z.string().nullable()]),
) as Record<keyof FormValues, z.ZodNullable<z.ZodString>>;

const ExtractedSchema = z.object(shape);

const FIELD_LIST = FIELD_KEYS.map((key) => `- ${key}: ${FIELD_LABELS[key]}`).join("\n");

const SYSTEM = `You extract answers for the Texas DL-14A Driver License / ID Card application from one short spoken sentence.

Fields:
${FIELD_LIST}

Rules:
- Return a value only for fields the speaker clearly stated. Every other field must be null.
- Never invent or guess a value.
- dateOfBirth must be mm/dd/yyyy. Phones must be (xxx) xxx-xxxx. Names are Title Case.
- heightFeet and heightInches are plain numbers. weight is a plain number in pounds.
- state and placeOfBirthState are two-letter codes when the state is clear.
- Speech-to-text artifacts are common: "at" may mean "@", "dot" may mean ".", spelled-out numbers should become digits.`;

export type ExtractResult = {
  values: Partial<FormValues>;
  error?: string;
};

export const extractFields = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<ExtractResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { values: {}, error: "AI is not configured." };

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key, undefined, {
      structuredOutputs: true,
    });

    try {
      const result = streamText({
        model: gateway("google/gemini-3.8-flash"),
        system: SYSTEM,
        prompt: data.transcript,
        output: Output.object({ schema: ExtractedSchema }),
      });

      const output = await result.output;
      const values: Partial<FormValues> = {};
      for (const field of FIELD_KEYS) {
        const value = output[field];
        if (typeof value === "string" && value.trim()) {
          values[field] = value.trim();
        }
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
