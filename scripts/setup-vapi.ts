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
import FormData from "form-data";
import { DESIGNERS } from "../src/config/designers";
import {
  ARIA_SYSTEM_PROMPT,
  ARIA_FIRST_MESSAGE,
  ARIA_AFTER_HOURS_SYSTEM_PROMPT,
  ARIA_AFTER_HOURS_FIRST_MESSAGE,
} from "../src/vapi/prompts/aria";
import {
  buildDesignerSystemPrompt,
  buildDesignerFirstMessage,
} from "../src/vapi/prompts/designer";

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SERVER_URL = process.env.SERVER_URL || "https://kcc-voice-agents.vercel.app";
const WEBHOOK_URL = `${SERVER_URL}/api/vapi/webhook`;

if (!VAPI_API_KEY) {
  console.error("Missing VAPI_API_KEY in .env");
  process.exit(1);
}

const vapi = axios.create({
  baseURL: "https://api.vapi.ai",
  headers: {
    Authorization: `Bearer ${VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
});

// ─── Tool Definitions (go inside model.tools) ────────────────

function getToolDefs() {
  return {
    pushToHubspot: {
      type: "function",
      function: {
        name: "push_to_hubspot",
        description: "Push lead data and measurement data to CRM. Call after collecting customer info.",
        parameters: {
          type: "object",
          properties: {
            contact_name: { type: "string", description: "Full name of the caller" },
            phone: { type: "string", description: "Phone number" },
            email: { type: "string", description: "Email address" },
            company: { type: "string", description: "Company name" },
            project_type: { type: "string", description: "kitchen_full, kitchen_partial, bathroom, laundry, garage, other" },
            linear_feet: { type: "number", description: "Total linear feet of cabinetry" },
            style_preference: { type: "string", description: "shaker, estate, or modern_wood" },
            preferred_designer: { type: "string", description: "Jen, Carlos, Nancy, Maria, or Derek" },
          },
          required: ["contact_name"],
        },
      },
      server: { url: WEBHOOK_URL },
      messages: [
        { type: "request-start", content: "Let me save that information..." },
        { type: "request-complete", content: "Got it, all saved!" },
        { type: "request-failed", content: "I had a little trouble saving that. Could you repeat?" },
      ],
    },
    collectMeasurements: {
      type: "function",
      function: {
        name: "collect_measurements",
        description: "Collect and store room measurements from caller",
        parameters: {
          type: "object",
          properties: {
            room_name: { type: "string" },
            length_ft: { type: "number" },
            width_ft: { type: "number" },
            ceiling_height_ft: { type: "number" },
            cabinet_style: { type: "string" },
            cabinet_color: { type: "string" },
            appliance_cutouts: { type: "array", items: { type: "string" } },
          },
          required: ["room_name", "length_ft", "width_ft"],
        },
      },
      server: { url: WEBHOOK_URL },
      messages: [
        { type: "request-start", content: "Let me save those measurements..." },
        { type: "request-complete", content: "Got it, all saved!" },
        { type: "request-failed", content: "Could you repeat those measurements?" },
      ],
    },
    checkBusinessHours: {
      type: "function",
      function: {
        name: "check_business_hours",
        description: "Check if Kitchen Crest Orlando office is currently open.",
        parameters: { type: "object", properties: {} },
      },
      server: { url: WEBHOOK_URL },
    },
    saveMessage: {
      type: "function",
      function: {
        name: "save_message",
        description: "Save an after-hours message from a caller.",
        parameters: {
          type: "object",
          properties: {
            caller_name: { type: "string" },
            callback_number: { type: "string" },
            message: { type: "string" },
          },
          required: ["caller_name", "callback_number", "message"],
        },
      },
      server: { url: WEBHOOK_URL },
      messages: [
        { type: "request-start", content: "Saving your message..." },
        { type: "request-complete", content: "I've saved your message. Our team will reach out first thing tomorrow morning." },
        { type: "request-failed", content: "Let me try again to save that." },
      ],
    },
  };
}

async function main() {
  console.log("\n🔧 Kitchen Crest Voice AI — Vapi Setup\n");
  console.log(`   Webhook URL: ${WEBHOOK_URL}\n`);

  const tools = getToolDefs();

  // ─── Step 1: Upload Knowledge Base Files ──────────────────
  console.log("📚 Step 1: Uploading knowledge base files...\n");
  const kbDir = path.join(__dirname, "..", "knowledge-base");
  const kbFiles = fs.readdirSync(kbDir).filter((f) => f.endsWith(".md"));
  const fileIds: string[] = [];

  for (const file of kbFiles) {
    const filePath = path.join(kbDir, file);
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: file,
      contentType: "text/markdown",
    });

    try {
      const { data } = await vapi.post("/file", form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
      });
      fileIds.push(data.id);
      console.log(`  ✓ ${file} → ${data.id}`);
    } catch (err: any) {
      console.error(`  ✗ ${file} — ${err.response?.data?.message || err.message}`);
    }
  }

  // Build KB query tool if files uploaded
  let kbTool: any = null;
  if (fileIds.length > 0) {
    kbTool = {
      type: "query",
      function: {
        name: "search_kitchen_crest_kb",
        description: "Search Kitchen Crest product catalog, FAQ, policies, and locations.",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      knowledgeBases: [{ name: "Kitchen Crest Knowledge Base", description: "Product catalog, FAQ, locations, policies, and SKU data for Kitchen Crest Cabinets", fileIds, provider: "google" }],
    };
  }

  // ─── Step 2: Create Aria (Main Receptionist) ──────────────
  console.log("\n🎙️  Step 2: Creating Aria (Main Receptionist)...\n");

  const ariaTools: any[] = [tools.pushToHubspot, tools.checkBusinessHours, tools.saveMessage];
  if (kbTool) ariaTools.push(kbTool);

  const { data: aria } = await vapi.post("/assistant", {
    name: "Aria - Main Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [{ role: "system", content: ARIA_SYSTEM_PROMPT }],
      tools: ariaTools,
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: ARIA_FIRST_MESSAGE,
    serverUrl: WEBHOOK_URL,
    endCallMessage: "Thank you for calling Kitchen Crest Cabinets! Have a great day.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  });
  console.log(`  ✓ Aria created: ${aria.id}`);

  // ─── Step 3: Create Aria After-Hours ──────────────────────
  console.log("\n🌙 Step 3: Creating Aria (After Hours)...\n");

  const { data: ariaAH } = await vapi.post("/assistant", {
    name: "Aria - After Hours",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [{ role: "system", content: ARIA_AFTER_HOURS_SYSTEM_PROMPT }],
      tools: [tools.saveMessage, tools.pushToHubspot],
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: ARIA_AFTER_HOURS_FIRST_MESSAGE,
    serverUrl: WEBHOOK_URL,
    endCallMessage: "Thank you for calling Kitchen Crest Cabinets. We'll reach out first thing tomorrow. Goodnight!",
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 20,
  });
  console.log(`  ✓ Aria After-Hours created: ${ariaAH.id}`);

  // ─── Step 4: Create Designer Assistants ───────────────────
  console.log("\n👥 Step 4: Creating Designer Assistants...\n");
  const designerIds: Record<string, string> = {};

  for (const designer of DESIGNERS) {
    const designerTools: any[] = [tools.pushToHubspot, tools.collectMeasurements];
    if (kbTool) designerTools.push(kbTool);

    // Add warm transfer tool
    designerTools.push({
      type: "transferCall",
      function: { name: `warmTransferTo${designer.name}` },
      destinations: [
        {
          type: "number",
          number: designer.phone,
          transferPlan: {
            mode: "warm-transfer-experimental",
            message: `Hi ${designer.name}, I have a caller interested in Kitchen Crest cabinets. Are you available?`,
            voicemailDetectionType: "transcript",
            fallbackPlan: {
              message: `${designer.name} is unavailable right now. They'll call you back within the hour.`,
              endCallEnabled: false,
            },
            summaryPlan: {
              enabled: true,
              messages: [
                {
                  role: "system",
                  content: `Summarize the caller's cabinet project for ${designer.name} in 2-3 sentences.`,
                },
              ],
            },
          },
        },
      ],
      messages: [
        { type: "request-start", content: `Let me check if ${designer.name} is available.` },
        { type: "request-failed", content: `${designer.name} isn't available right now.` },
      ],
    });

    const { data: asst } = await vapi.post("/assistant", {
      name: designer.assistantName,
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          { role: "system", content: buildDesignerSystemPrompt(designer) },
        ],
        tools: designerTools,
      },
      voice: { provider: "vapi", voiceId: "Elliot" },
      firstMessage: buildDesignerFirstMessage(designer),
      serverUrl: WEBHOOK_URL,
      endCallMessage: `Thanks for reaching out to ${designer.name}'s team at Kitchen Crest. We'll be in touch!`,
      maxDurationSeconds: 600,
      silenceTimeoutSeconds: 30,
      backchannelingEnabled: true,
    });

    designerIds[designer.name] = asst.id;
    console.log(`  ✓ ${designer.assistantName}: ${asst.id}`);
  }

  // ─── Step 5: Create Squad ─────────────────────────────────
  console.log("\n🏢 Step 5: Creating Kitchen Crest Squad...\n");

  const handoffDestinations = DESIGNERS.map((d) => ({
    type: "assistant",
    assistantId: designerIds[d.name],
    description: `Transfer when caller asks for ${d.name} or is identified as ${d.name}'s client.`,
  }));

  const { data: squad } = await vapi.post("/squad", {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: aria.id,
        assistantOverrides: {
          model: {
            provider: "openai",
            model: "gpt-4o",
            tools: [
              ...ariaTools,
              {
                type: "handoff",
                destinations: handoffDestinations,
                function: { name: "handoff_to_designer" },
              },
            ],
          },
        },
      },
      ...DESIGNERS.map((d) => ({
        assistantId: designerIds[d.name],
      })),
    ],
  });
  console.log(`  ✓ Squad created: ${squad.id}`);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  SETUP COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  Aria (Main):        ${aria.id}`);
  console.log(`  Aria (After Hours): ${ariaAH.id}`);
  for (const [name, id] of Object.entries(designerIds)) {
    console.log(`  ${name}'s Assistant:  ${id}`);
  }
  console.log(`  Squad:              ${squad.id}`);
  console.log(`  Knowledge Base:     ${fileIds.length} files`);
  console.log(`  Webhook:            ${WEBHOOK_URL}`);

  console.log(`\n  Add to .env:`);
  console.log(`  VAPI_ARIA_ASSISTANT_ID=${aria.id}`);
  console.log(`  VAPI_ARIA_AFTER_HOURS_ID=${ariaAH.id}`);
  console.log(`  VAPI_SQUAD_ID=${squad.id}`);

  console.log("\n  Next: Buy a phone number in Vapi dashboard → assign squad → call it!\n");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  if (err.response?.data) {
    console.error("API response:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
