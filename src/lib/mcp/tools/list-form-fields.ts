import { defineTool } from "@lovable.dev/mcp-js";
import { FIELD_LABELS } from "@/lib/form-parser";

export default defineTool({
  name: "list_form_fields",
  title: "List application fields",
  description:
    "List the fields of the Texas Driver License / ID Card Application (Form DL-14A) that FormBuddy can fill.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const fields = Object.entries(FIELD_LABELS).map(([name, label]) => ({
      name,
      label,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: fields.map((f) => `${f.name}: ${f.label}`).join("\n"),
        },
      ],
      structuredContent: { fields },
    };
  },
});
