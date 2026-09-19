import fs from "node:fs";
import path from "node:path";
import { parseTranscript, type FormValues, EMPTY_FORM } from "../src/lib/form-parser";
import { createUtilityAssistancePdf, inspectPdfFields } from "../src/lib/pdf-service";

async function runVerification() {
  console.log("================================================================================");
  console.log("  VERBAL FORM BUDDY: VOICE AGENT TO PDF FORM VERIFICATION TEST");
  console.log("================================================================================\n");

  // Simulated spoken transcript sentences typical of real callers
  const spokenTranscripts = [
    "Hello, my name is Carlos Rodriguez",
    "I was born on January 15, 1982",
    "My phone number is 555-432-8765 and my email is carlos dot rodriguez at example dot com",
    "I live at 742 Evergreen Terrace Springfield IL 62704",
    "My household size is 4 people",
    "Our monthly income is about 2850 dollars",
    "My utility company is Springfield Electric and Power",
    "My account number is 8849201934",
  ];

  console.log("1. Simulating caller voice transcripts through Speech Entity Parser:");
  let formValues: FormValues = { ...EMPTY_FORM };

  for (const sentence of spokenTranscripts) {
    console.log(`   🗣️ Spoken: "${sentence}"`);
    const parsed = parseTranscript(sentence);
    formValues = { ...formValues, ...parsed };
    const extractedKeys = Object.keys(parsed);
    if (extractedKeys.length > 0) {
      console.log(`      ↳ Extracted: ${JSON.stringify(parsed)}`);
    } else {
      console.log(`      ↳ (No new fields recognized)`);
    }
  }

  console.log("\n2. Aggregated Form State from Voice:");
  console.table(formValues);

  console.log("3. Generating Official PDF AcroForm with Voice-Extracted Fields...");
  const pdfBytes = await createUtilityAssistancePdf(formValues, { flatten: false });
  console.log(`   ✅ Successfully compiled PDF document! File size: ${pdfBytes.length} bytes.`);

  console.log("\n4. Loading & Inspecting AcroForm Fields directly from Generated PDF binary...");
  const extractedFromPdf = await inspectPdfFields(pdfBytes);
  console.log("   AcroForm Fields Found in PDF Document:");
  console.table(extractedFromPdf);

  console.log("5. Running Strict Equality Assertions between Voice State and PDF AcroForm:");

  const expectations: Array<[keyof FormValues, string]> = [
    ["fullName", "Carlos Rodriguez"],
    ["dateOfBirth", "January 15, 1982"],
    ["phone", "(555) 432-8765"],
    ["email", "carlos.rodriguez@example.com"],
    ["address", "742 Evergreen Terrace Springfield IL 62704"],
    ["householdSize", "4"],
    ["monthlyIncome", "$2,850"],
    ["utilityProvider", "Springfield Electric and Power"],
    ["accountNumber", "8849201934"],
  ];

  let passed = true;
  for (const [key, expectedValue] of expectations) {
    const actualPdfValue = extractedFromPdf[key];
    const match = actualPdfValue === expectedValue;
    if (match) {
      console.log(`   ✅ [MATCH] ${key.padEnd(16)}: "${actualPdfValue}"`);
    } else {
      console.error(
        `   ❌ [MISMATCH] ${key.padEnd(16)}: Expected "${expectedValue}", Got "${actualPdfValue}"`,
      );
      passed = false;
    }
  }

  // Check automated stamps
  if (extractedFromPdf["intakeAgent"]?.includes("FormBuddy")) {
    console.log(`   ✅ [MATCH] intakeAgent     : "${extractedFromPdf["intakeAgent"]}"`);
  } else {
    console.error(`   ❌ [MISMATCH] intakeAgent: Expected FormBuddy stamp`);
    passed = false;
  }

  if (extractedFromPdf["filingDate"] && extractedFromPdf["filingDate"].length > 0) {
    console.log(`   ✅ [MATCH] filingDate      : "${extractedFromPdf["filingDate"]}"`);
  } else {
    console.error(`   ❌ [MISMATCH] filingDate: Expected filing date`);
    passed = false;
  }

  // Write output PDF to disk for manual inspection
  const outDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outputPath = path.join(outDir, "verified-filled-application.pdf");
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  console.log(`\n6. Saved verified filled PDF to: ${outputPath}`);

  if (passed) {
    console.log("\n🎉 ALL TESTS PASSED! Voice-to-PDF filling is 100% verified.");
  } else {
    console.error("\n❌ VERIFICATION FAILED! Some fields did not match.");
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
