import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { FormValues } from "./form-parser";

export interface PdfFieldMapping {
  pdfField: string;
  formKey: keyof FormValues;
  label: string;
}

export const PDF_FIELD_MAPPINGS: PdfFieldMapping[] = [
  { pdfField: "fullName", formKey: "fullName", label: "Full Name" },
  { pdfField: "dateOfBirth", formKey: "dateOfBirth", label: "Date of Birth" },
  { pdfField: "phone", formKey: "phone", label: "Phone Number" },
  { pdfField: "email", formKey: "email", label: "Email Address" },
  { pdfField: "address", formKey: "address", label: "Home Address" },
  { pdfField: "householdSize", formKey: "householdSize", label: "Household Size" },
  { pdfField: "monthlyIncome", formKey: "monthlyIncome", label: "Monthly Income" },
  { pdfField: "utilityProvider", formKey: "utilityProvider", label: "Utility Provider" },
  { pdfField: "accountNumber", formKey: "accountNumber", label: "Account Number" },
];

/**
 * Creates the official Utility Assistance Application PDF with interactive AcroForm fields.
 */
export async function createUtilityAssistancePdf(
  values: FormValues,
  options: { flatten?: boolean } = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("Utility Assistance Application - Voice Filled");
  pdfDoc.setAuthor("FormBuddy Voice Agent");
  pdfDoc.setSubject("State Residential Utility Assistance Program Application");
  pdfDoc.setProducer("FormBuddy Voice Engine via pdf-lib");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Standard US Letter (612 x 792 pt)
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();

  // Colors
  const primaryColor = rgb(0.12, 0.28, 0.49); // Dark navy
  const primaryLight = rgb(0.92, 0.95, 0.98); // Soft navy tint
  const headerBg = rgb(0.16, 0.32, 0.54);
  const textDark = rgb(0.1, 0.12, 0.15);
  const textMuted = rgb(0.4, 0.45, 0.5);
  const borderColor = rgb(0.75, 0.8, 0.85);
  const fieldBg = rgb(0.97, 0.98, 1.0);

  // --- 1. Top Header Banner ---
  page.drawRectangle({
    x: 40,
    y: 710,
    width: 532,
    height: 52,
    color: primaryLight,
    borderColor: primaryColor,
    borderWidth: 1.5,
  });

  page.drawText("STATE RESIDENTIAL UTILITY ASSISTANCE PROGRAM", {
    x: 52,
    y: 742,
    size: 13,
    font: boldFont,
    color: primaryColor,
  });

  page.drawText("LIHEAP / Low-Income Home Energy & Water Assistance Official Intake Form", {
    x: 52,
    y: 726,
    size: 9.5,
    font,
    color: textDark,
  });

  page.drawText("FORM: UAP-2026-V1", {
    x: 450,
    y: 742,
    size: 9,
    font: boldFont,
    color: primaryColor,
  });

  page.drawText("INTAKE: VOICE ASSISTED", {
    x: 430,
    y: 726,
    size: 7.5,
    font: boldFont,
    color: textMuted,
  });

  // Notice bar
  page.drawRectangle({
    x: 40,
    y: 676,
    width: 532,
    height: 24,
    color: rgb(0.95, 0.97, 0.95),
    borderColor: rgb(0.65, 0.8, 0.65),
    borderWidth: 1,
  });

  page.drawText(
    "Automated Voice Intake Record — Spoken responses are transcribed, parsed, and mapped into this AcroForm document.",
    {
      x: 52,
      y: 684,
      size: 7.5,
      font: obliqueFont,
      color: rgb(0.15, 0.45, 0.2),
    },
  );

  // Helper for Section Headers
  const drawSectionHeader = (title: string, yPos: number) => {
    page.drawRectangle({
      x: 40,
      y: yPos,
      width: 532,
      height: 18,
      color: headerBg,
    });
    page.drawText(title, {
      x: 48,
      y: yPos + 4.5,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
  };

  // Helper to create and place interactive text field
  const createField = (
    name: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number = 22,
    fontSize: number = 9.5,
  ) => {
    const tf = form.createTextField(name);
    tf.addToPage(page, {
      x,
      y,
      width,
      height,
      borderColor,
      borderWidth: 1,
      backgroundColor: fieldBg,
      textColor: textDark,
    });
    tf.setFontSize(fontSize);
    tf.setText(value || "");
    return tf;
  };

  // --- SECTION 1: APPLICANT INFORMATION ---
  drawSectionHeader("1. APPLICANT IDENTIFICATION", 644);

  // Full Name & DOB
  page.drawText("Full Legal Name:", { x: 40, y: 628, size: 8.5, font: boldFont, color: textDark });
  createField("fullName", values.fullName, 40, 602, 256);

  page.drawText("Date of Birth:", { x: 316, y: 628, size: 8.5, font: boldFont, color: textDark });
  createField("dateOfBirth", values.dateOfBirth, 316, 602, 256);

  // Phone & Email
  page.drawText("Primary Phone Number:", {
    x: 40,
    y: 584,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("phone", values.phone, 40, 558, 256);

  page.drawText("Email Address:", { x: 316, y: 584, size: 8.5, font: boldFont, color: textDark });
  createField("email", values.email, 316, 558, 256);

  // Address
  page.drawText("Primary Residential Address:", {
    x: 40,
    y: 540,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("address", values.address, 40, 514, 532);

  // --- SECTION 2: HOUSEHOLD & FINANCIAL ELIGIBILITY ---
  drawSectionHeader("2. HOUSEHOLD & FINANCIAL ELIGIBILITY", 482);

  // Household Size & Monthly Income
  page.drawText("Household Size (Total Persons):", {
    x: 40,
    y: 466,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("householdSize", values.householdSize, 40, 440, 256);

  page.drawText("Gross Monthly Household Income:", {
    x: 316,
    y: 466,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("monthlyIncome", values.monthlyIncome, 316, 440, 256);

  // --- SECTION 3: UTILITY ACCOUNT INFORMATION ---
  drawSectionHeader("3. UTILITY ACCOUNT DETAILS", 408);

  // Utility Provider & Account Number
  page.drawText("Utility Provider / Utility Company:", {
    x: 40,
    y: 392,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("utilityProvider", values.utilityProvider, 40, 366, 256);

  page.drawText("Customer Account Number:", {
    x: 316,
    y: 392,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("accountNumber", values.accountNumber, 316, 366, 256);

  // --- SECTION 4: INTAKE AUDIT & CERTIFICATION ---
  drawSectionHeader("4. VERBAL INTAKE CERTIFICATION & AUDIT LOG", 334);

  const todayStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  page.drawText("Application Filing Date:", {
    x: 40,
    y: 318,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("filingDate", todayStr, 40, 292, 256);

  page.drawText("Intake Processing System:", {
    x: 316,
    y: 318,
    size: 8.5,
    font: boldFont,
    color: textDark,
  });
  createField("intakeAgent", "FormBuddy Voice Assistant (Verbal Intake)", 316, 292, 256);

  // Certification Box
  page.drawRectangle({
    x: 40,
    y: 160,
    width: 532,
    height: 118,
    color: rgb(0.98, 0.98, 0.99),
    borderColor,
    borderWidth: 1,
  });

  page.drawText("APPLICANT VERBAL CERTIFICATION & STATEMENT OF TRUTH", {
    x: 52,
    y: 260,
    size: 8.5,
    font: boldFont,
    color: primaryColor,
  });

  const certLines = [
    "I hereby attest that the information provided via automated verbal intake has been truthfully and accurately recorded.",
    "I understand that intentionally providing false information in this assistance application is subject to disqualification",
    "and state legal penalties. By verbal confirmation, I authorize the State Assistance Agency to verify my income and utility",
    "billing records with the designated utility provider for grant payment determination.",
  ];

  let certY = 246;
  for (const line of certLines) {
    page.drawText(line, {
      x: 52,
      y: certY,
      size: 7.5,
      font,
      color: textMuted,
    });
    certY -= 11;
  }

  // Verbal Signature & Verification Badge
  page.drawText("Applicant Verbal Signature Status:", {
    x: 52,
    y: 194,
    size: 8,
    font: boldFont,
    color: textDark,
  });

  page.drawText("VERBALLY VERIFIED VIA FORMBUDDY VOICE SESSION", {
    x: 215,
    y: 194,
    size: 8,
    font: boldFont,
    color: rgb(0.1, 0.55, 0.25),
  });

  page.drawText(
    `Verification Timestamp: ${new Date().toISOString()} • Session Engine: WebSpeech + AcroForm Sync`,
    {
      x: 52,
      y: 176,
      size: 7,
      font: obliqueFont,
      color: textMuted,
    },
  );

  // Footer Line
  page.drawLine({
    start: { x: 40, y: 65 },
    end: { x: 572, y: 65 },
    thickness: 0.75,
    color: borderColor,
  });

  page.drawText(
    "Form UAP-2026-V1 • Low Income Home Energy Assistance Program • Official State Assistance Form",
    {
      x: 40,
      y: 50,
      size: 7.5,
      font,
      color: textMuted,
    },
  );

  page.drawText("Page 1 of 1", {
    x: 528,
    y: 50,
    size: 7.5,
    font: boldFont,
    color: textMuted,
  });

  if (options.flatten) {
    form.flatten();
  }

  return await pdfDoc.save();
}

/**
 * Inspects any PDF with form fields and returns all field names and text values.
 * Useful for automated verification and checking fidelity.
 */
export async function inspectPdfFields(pdfBytes: Uint8Array): Promise<Record<string, string>> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const result: Record<string, string> = {};

  for (const field of fields) {
    const name = field.getName();
    try {
      const textField = form.getTextField(name);
      result[name] = textField.getText() ?? "";
    } catch {
      // Not a text field or unreadable
      result[name] = "[non-text-field]";
    }
  }

  return result;
}

/**
 * Generates a browser Blob URL for previewing or downloading the PDF.
 */
export function createPdfBlobUrl(pdfBytes: Uint8Array): string {
  // Create a Blob from the byte array with proper application/pdf MIME type
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * Triggers an instant download of the PDF in browser.
 */
export function downloadPdf(
  pdfBytes: Uint8Array,
  filename = "utility-assistance-application.pdf",
): void {
  const blobUrl = createPdfBlobUrl(pdfBytes);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
