/**
 * Vapi Provisioning Script
 *
 * Creates all assistants, uploads knowledge base files, and configures the squad.
 * Run: npx tsx scripts/setup-vapi.ts
 */
import "dotenv/config";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { DESIGNERS } from "../src/config/designers";
import { buildAriaAssistant, buildAriaAfterHoursAssistant, buildDesignerAssistant } from "../src/vapi/assistants";
import { buildSquadConfig } from "../src/vapi/squad";

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SERVER_URL = process.env.SERVER_URL;

if (!VAPI_API_KEY) {
  console.error("Missing VAPI_API_KEY in .env");
  process.exit(1);
}
if (!SERVER_URL) {
  console.error("Missing SERVER_URL in .env");
  process.exit(1);
}

const vapi = axios.create({
  baseURL: "https://api.vapi.ai",
  headers: {
    Authorization: `Bearer ${VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
});

async function main() {
  console.log("\n🔧 Kitchen Crest Voice AI — Vapi Setup\n");

  // ─── Step 1: Upload Knowledge Base Files ────────────────────
  console.log("📚 Step 1: Uploading knowledge base files...\n");
  const kbDir = path.join(__dirname, "..", "knowledge-base");
  const kbFiles = fs.readdirSync(kbDir).filter((f) => f.endsWith(".md"));
  const fileIds: string[] = [];

  for (const file of kbFiles) {
    const filePath = path.join(kbDir, file);
    const formData = new FormData();
    const fileContent = fs.readFileSync(filePath);
    formData.append("file", new Blob([fileContent]), file);

    try {
      const { data } = await vapi.post("/file", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fileIds.push(data.id);
      console.log(`  ✓ Uploaded: ${file} → ${data.id}`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${file} — ${err.response?.data?.message || err.message}`);
    }
  }

  // ─── Step 2: Create Aria (Main Receptionist) ────────────────
  console.log("\n🎙️ Step 2: Creating Aria (Main Receptionist)...\n");
  const ariaConfig = buildAriaAssistant(SERVER_URL);

  // Add knowledge base query tool with uploaded files
  if (fileIds.length > 0) {
    (ariaConfig.tools as any[]).push({
      type: "query",
      function: {
        name: "search_kitchen_crest_kb",
        description:
          "Search Kitchen Crest product catalog, FAQ, policies, and location information to answer customer questions accurately.",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      knowledgeBases: [
        {
          fileIds,
          provider: "google",
        },
      ],
    });
  }

  const { data: aria } = await vapi.post("/assistant", ariaConfig);
  console.log(`  ✓ Aria created: ${aria.id}`);

  // ─── Step 3: Create Aria After-Hours ────────────────────────
  console.log("\n🌙 Step 3: Creating Aria (After Hours)...\n");
  const afterHoursConfig = buildAriaAfterHoursAssistant(SERVER_URL);
  const { data: ariaAfterHours } = await vapi.post("/assistant", afterHoursConfig);
  console.log(`  ✓ Aria After-Hours created: ${ariaAfterHours.id}`);

  // ─── Step 4: Create Designer Assistants ─────────────────────
  console.log("\n👥 Step 4: Creating Designer Assistants...\n");
  const designerIds: Record<string, string> = {};

  for (const designer of DESIGNERS) {
    const config = buildDesignerAssistant(designer, SERVER_URL);

    // Add knowledge base to each designer too
    if (fileIds.length > 0) {
      (config.tools as any[]).push({
        type: "query",
        function: {
          name: "search_kitchen_crest_kb",
          description:
            "Search Kitchen Crest product catalog for cabinet dimensions, SKUs, and specifications.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
        },
        knowledgeBases: [{ fileIds, provider: "google" }],
      });
    }

    const { data: asst } = await vapi.post("/assistant", config);
    designerIds[designer.name] = asst.id;
    console.log(`  ✓ ${designer.assistantName} created: ${asst.id}`);
  }

  // ─── Step 5: Create Squad ──────────────────────────────────
  console.log("\n🏢 Step 5: Creating Kitchen Crest Squad...\n");
  const squadConfig = buildSquadConfig({
    ariaId: aria.id,
    designerIds,
  });

  const { data: squad } = await vapi.post("/squad", squadConfig);
  console.log(`  ✓ Squad created: ${squad.id}`);

  // ─── Step 6: Configure Phone Number ─────────────────────────
  if (process.env.VAPI_PHONE_NUMBER_ID) {
    console.log("\n📞 Step 6: Configuring phone number...\n");
    try {
      await vapi.patch(`/phone-number/${process.env.VAPI_PHONE_NUMBER_ID}`, {
        squadId: squad.id,
        serverUrl: `${SERVER_URL}/vapi/webhook`,
        serverMessages: ["assistant-request", "end-of-call-report", "tool-calls"],
      });
      console.log(`  ✓ Phone number configured with squad`);
    } catch (err: any) {
      console.error(`  ✗ Phone config failed: ${err.response?.data?.message || err.message}`);
      console.log(`  → Manually assign squad ${squad.id} to your phone number in the Vapi dashboard`);
    }
  } else {
    console.log("\n📞 Step 6: Skipping phone config (no VAPI_PHONE_NUMBER_ID in .env)");
    console.log(`  → Buy a phone number in the Vapi dashboard and assign squad: ${squad.id}`);
  }

  // ─── Summary ───────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  SETUP COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  Aria (Main):        ${aria.id}`);
  console.log(`  Aria (After Hours): ${ariaAfterHours.id}`);
  for (const [name, id] of Object.entries(designerIds)) {
    console.log(`  ${name}'s Assistant:  ${id}`);
  }
  console.log(`  Squad:              ${squad.id}`);
  console.log(`  Knowledge Base:     ${fileIds.length} files uploaded`);

  console.log(`\n  Add these to your .env:`);
  console.log(`  VAPI_ARIA_ASSISTANT_ID=${aria.id}`);
  console.log(`  VAPI_ARIA_AFTER_HOURS_ID=${ariaAfterHours.id}`);
  console.log(`  VAPI_SQUAD_ID=${squad.id}`);

  console.log("\n  Next steps:");
  console.log("  1. Buy a phone number (Orlando 407 area code) in Vapi dashboard");
  console.log("  2. Assign the squad to the phone number");
  console.log("  3. Start your webhook server: npm run dev");
  console.log("  4. Expose it: npm run tunnel (or deploy)");
  console.log("  5. Call the number and test!\n");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  if (err.response?.data) {
    console.error("API response:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
