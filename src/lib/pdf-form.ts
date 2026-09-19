import { PDFDocument } from "pdf-lib";
import type { FormValues } from "@/lib/form-parser";

export const PDF_TEMPLATE_URL = "/forms/dl-14a.pdf";

/** Maps our collected values to the real field names inside Form DL-14A. */
const FIELD_MAP: Record<keyof FormValues, string> = {
  lastName: "Last Name",
  firstName: "First Name",
  middleName: "Middle Name",
  dateOfBirth: "Date of Birth mmddyyyy",
  ssn: "SSN",
  heightFeet: "Height",
  heightInches: "Ft",
  weight: "Weight",
  placeOfBirthCity: "Place of birth City",
  placeOfBirthState: "State",
  fathersLastName: "Fathers Last Name",
  mothersMaidenName: "Mothers Maiden Name",
  residenceAddress: "Residence Address",
  city: "City",
  state: "State_2",
  zipCode: "Zip Code",
  county: "County_2",
  phone: "Primary Phone",
  cellPhone: "Cellular Phone",
  email: "Email",
  emergencyName: "a Name",
  emergencyPhone: "Phone Number",
  emergencyAddress: "Address",
};

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
  options: { flatten?: boolean } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await loadTemplate());
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const pdfName = FIELD_MAP[name as keyof FormValues];
    if (!pdfName) continue;
    try {
      form.getTextField(pdfName).setText(value ?? "");
    } catch {
      // field not present in this template — skip
    }
  }
  if (options.flatten) {
    try {
      form.flatten();
    } catch {
      // some widgets can't be flattened — keep the filled fields instead
    }
  }
  return doc.save();
}

export function pdfBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
}
