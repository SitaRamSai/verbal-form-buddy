import { PDFDocument } from "pdf-lib";
import type { FormValues } from "@/lib/form-parser";

export const PDF_TEMPLATE_URL = "/forms/utility-assistance.pdf";

let templateBytes: ArrayBuffer | null = null;

async function loadTemplate(): Promise<ArrayBuffer> {
  if (templateBytes) return templateBytes.slice(0);
  const res = await fetch(PDF_TEMPLATE_URL);
  if (!res.ok) throw new Error("Could not load the application form.");
  templateBytes = await res.arrayBuffer();
  return templateBytes.slice(0);
}

/** Fills the real PDF form with the collected values and returns a blob URL. */
export async function fillPdf(values: FormValues): Promise<string> {
  const doc = await PDFDocument.load(await loadTemplate());
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    try {
      form.getTextField(name).setText(value ?? "");
    } catch {
      // field not present in this template — skip
    }
  }
  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
