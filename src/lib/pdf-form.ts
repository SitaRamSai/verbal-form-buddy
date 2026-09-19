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

/**
 * Fills the real PDF form (AcroForm text fields) with the collected values.
 * `flatten` bakes the values into the page so any viewer shows them.
 */
export async function fillPdf(
  values: FormValues,
  options: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await loadTemplate());
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    try {
      form.getTextField(name).setText(value ?? "");
    } catch {
      // field not present in this template — skip
    }
  }
  if (options.flatten) form.flatten();
  return doc.save();
}

export function pdfBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" })
  );
}
