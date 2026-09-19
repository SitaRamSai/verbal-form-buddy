import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { detectCommand, parseTranscript, FIELD_LABELS } from "@/lib/form-parser";

export default defineTool({
  name: "parse_spoken_answers",
  title: "Parse spoken answers",
  description:
    "Turn a spoken or typed sentence (for example \"my name is Maria Lopez and my monthly income is twelve hundred dollars\") into Utility Assistance Application field values. Also detects the voice commands repeat, why, save and documents.",
  inputSchema: {
    transcript: z
      .string()
      .min(1)
      .describe("What the applicant said, in plain language."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ transcript }) => {
    const values = parseTranscript(transcript);
    const command = detectCommand(transcript);
    const entries = Object.entries(values);
    const summary = entries.length
      ? entries
          .map(([field, value]) => `${FIELD_LABELS[field as keyof typeof FIELD_LABELS]}: ${value}`)
          .join("\n")
      : "No application fields were recognised in that sentence.";

    return {
      content: [
        {
          type: "text" as const,
          text: command ? `${summary}\n\nVoice command: ${command}` : summary,
        },
      ],
      structuredContent: {
        fields: entries.map(([name, value]) => ({ name, value: String(value) })),
        command: command ?? null,
      },
    };
  },
});
