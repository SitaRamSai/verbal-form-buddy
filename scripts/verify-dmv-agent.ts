import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { DmvVoiceAgent } from "../src/lib/dmv-agent";
import { createTexasDmvPdf } from "../src/lib/dmv-pdf-service";

async function verifyDmvAutonomousAgent() {
  console.log("================================================================================");
  console.log("  TEXAS DPS DL-14A: AUTONOMOUS VOICE AGENT INTERVIEW & PDF VERIFICATION");
  console.log("================================================================================\n");

  const agent = new DmvVoiceAgent();

  console.log("1. Agent Initializes Interview Agenda based on PaddleOCR DL-14A Schema:");
  const greeting = agent.getInitialGreeting();
  console.log(`   🤖 Agent: "${greeting}"\n`);

  // Simulated conversational dialogue where applicant speaks naturally
  const callerUtterances = [
    // Turn 1: Application type & transaction
    "Hi there! I'm applying for a Texas Driver License, class C. It's a renewal.",

    // Turn 2: Personal Identity (Name, DOB, Sex, SSN)
    "My name is Carlos Rodriguez and I was born on January 15, 1982. I'm male, and my social security number is 555-43-8765.",

    // Turn 3: Physical Descriptors (Compound turn: height, weight, eyes, hair)
    "I'm 5 foot 10 inches tall, weigh about 180 pounds, with brown eyes and black hair.",

    // Turn 4: Residential address & contact (Address, city, zip, phone, email)
    "I live at 742 Evergreen Terrace in the city of Austin, Texas, zip code 78701, Travis county. My phone is 555-432-8765 and email is carlos dot rodriguez at example dot com.",

    // Turn 5: Statutory & Eligibility Questions
    "Yes I am a US citizen, yes please register me to vote, no I'm not a veteran, and yes add me as an organ donor.",
  ];

  for (let i = 0; i < callerUtterances.length; i++) {
    const utterance = callerUtterances[i]!;
    console.log(`--- Turn ${i + 1} ---`);
    console.log(`🗣️ Caller: "${utterance}"`);

    const decision = agent.processSpokenInput(utterance);

    console.log(
      `   ↳ [Agent Extracted Keys] : ${decision.newlyExtractedKeys.join(", ") || "(none)"}`,
    );
    console.log(`   ↳ [Agent Next Stage]    : ${decision.nextStage}`);
    console.log(`   ↳ [Agent Reasoning]     : ${decision.decisionReasoning}`);
    console.log(`   🤖 Agent Utterance       : "${decision.agentUtterance}"\n`);
  }

  const progress = agent.getProgress();
  console.log(
    `2. Final Progress: ${progress.filled}/${progress.total} keys collected (${progress.percentage}%).\n`,
  );

  console.log("3. Final Agent Collected State:");
  console.table(agent.values);

  console.log("4. Compiling Official Texas DPS DL-14A PDF with AcroForm Fields...");
  const pdfBytes = await createTexasDmvPdf(agent.values, { flatten: false });
  console.log(`   ✅ Successfully compiled Texas DL-14A PDF! Size: ${pdfBytes.length} bytes.\n`);

  console.log("5. Inspecting AcroForm Fields in Compiled PDF Document...");
  const loadedPdf = await PDFDocument.load(pdfBytes);
  const form = loadedPdf.getForm();
  const fields = form.getFields();
  console.log(`   Total interactive fields in PDF: ${fields.length}`);

  // Strict assertions
  const textAssertions: Record<string, string> = {
    firstName: "Carlos",
    lastName: "Rodriguez",
    dateOfBirth: "01/15/1982",
    heightFt: "5",
    heightIn: "10",
    weightLbs: "180",
    eyeColor: "Brown",
    hairColor: "Black",
    residenceAddress: "742 Evergreen Terrace",
    city: "Austin",
    zipCode: "78701",
    county: "Travis",
    phone: "(555) 432-8765",
    email: "carlos.rodriguez@example.com",
    ssn: "555-43-8765",
  };

  let allPassed = true;
  for (const [fieldName, expectedVal] of Object.entries(textAssertions)) {
    try {
      const actualVal = form.getTextField(fieldName).getText();
      if (actualVal === expectedVal) {
        console.log(`   ✅ [MATCH] ${fieldName.padEnd(18)} : "${actualVal}"`);
      } else {
        console.error(
          `   ❌ [MISMATCH] ${fieldName.padEnd(18)} : Expected "${expectedVal}", Got "${actualVal}"`,
        );
        allPassed = false;
      }
    } catch (err) {
      console.error(`   ❌ [ERROR] Could not read field "${fieldName}":`, err);
      allPassed = false;
    }
  }

  // Checkbox assertions
  const isCitizenYes = form.getCheckBox("q_1_yes").isChecked();
  const organDonorYes = form.getCheckBox("q_5_yes").isChecked();
  const isVeteranNo = form.getCheckBox("q_3_no").isChecked();

  if (isCitizenYes && organDonorYes && isVeteranNo) {
    console.log(
      `   ✅ [MATCH] Statutory Yes/No Checkboxes: Citizen=YES, OrganDonor=YES, Veteran=NO`,
    );
  } else {
    console.error(`   ❌ [MISMATCH] Statutory checkboxes failed`);
    allPassed = false;
  }

  // Write output PDF to disk
  const outDir = path.resolve(process.cwd(), "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPdfPath = path.join(outDir, "verified-texas-dl14a.pdf");
  fs.writeFileSync(outPdfPath, Buffer.from(pdfBytes));
  console.log(`\n6. Saved verified Texas DL-14A application to: ${outPdfPath}`);

  if (allPassed) {
    console.log("\n🎉 ALL TEXAS DMV AUTONOMOUS AGENT TESTS PASSED!");
  } else {
    console.error("\n❌ TESTS FAILED!");
    process.exit(1);
  }
}

verifyDmvAutonomousAgent().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
