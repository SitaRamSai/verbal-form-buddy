import { defineMcp } from "@lovable.dev/mcp-js";
import listFormFieldsTool from "./tools/list-form-fields";
import parseSpokenAnswersTool from "./tools/parse-spoken-answers";

export default defineMcp({
  name: "form-filler-friend",
  title: "Form Filler Friend",
  version: "0.1.0",
  instructions:
    "Tools for FormBuddy, a voice assistant that fills the Texas Driver License / ID Card Application (Form DL-14A). Use `list_form_fields` to see the fields, and `parse_spoken_answers` to turn what an applicant said into field values.",
  tools: [listFormFieldsTool, parseSpokenAnswersTool],
});
