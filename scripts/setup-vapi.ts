/**
 * Vapi Provisioning Script
 *
 * Creates all assistants, uploads knowledge base files, and configures the squad.
 * Architecture: Maria (Receptionist) + Jason (Universal Design Assistant)
 *
 * Run: npx tsx scripts/setup-vapi.ts
 */
import "dotenv/config";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import { DESIGNERS } from "../src/config/designers";
import {
  MARIA_SYSTEM_PROMPT,
  MARIA_FIRST_MESSAGE,
  MARIA_AFTER_HOURS_SYSTEM_PROMPT,
  MARIA_AFTER_HOURS_FIRST_MESSAGE,
} from "../src/vapi/prompts/maria";
import { JASON_SYSTEM_PROMPT, JASON_FIRST_MESSAGE } from "../src/vapi/prompts/jason";

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
            preferred_designer: { type: "string", description: "Jen, Carlos, Nancy, or Derek" },
            referred_by: { type: "string", description: "Who referred the caller, if anyone" },
          },
          required: ["contact_name"],
        },
      },
      server: { url: WEBHOOK_URL },
      messages: [
        { type: "request-start", content: "One sec while I save that..." },
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
        { type: "request-start", content: "One sec while I save those measurements..." },
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
  console.log("\n🔧 Kitchen Crest Voice AI — Vapi Setup (2-Agent Architecture)\n");
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

  // ─── Step 2: Create Maria (Main Receptionist) ──────────────
  console.log("\n🎙️  Step 2: Creating Maria (Receptionist)...\n");

  const mariaTools: any[] = [tools.pushToHubspot, tools.checkBusinessHours, tools.saveMessage];
  if (kbTool) mariaTools.push(kbTool);

  const { data: maria } = await vapi.post("/assistant", {
    name: "Maria - Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "system", content: MARIA_SYSTEM_PROMPT }],
      tools: mariaTools,
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: MARIA_FIRST_MESSAGE,
    serverUrl: WEBHOOK_URL,
    endCallMessage: "Thanks for calling Kitchen Crest Cabinets! Have a great day.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.5,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  });
  console.log(`  ✓ Maria created: ${maria.id}`);

  // ─── Step 3: Create Maria After-Hours ──────────────────────
  console.log("\n🌙 Step 3: Creating Maria (After Hours)...\n");

  const { data: mariaAH } = await vapi.post("/assistant", {
    name: "Maria - After Hours",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "system", content: MARIA_AFTER_HOURS_SYSTEM_PROMPT }],
      tools: [tools.saveMessage, tools.pushToHubspot],
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: MARIA_AFTER_HOURS_FIRST_MESSAGE,
    serverUrl: WEBHOOK_URL,
    endCallMessage: "Thanks for calling Kitchen Crest Cabinets. We'll reach out first thing tomorrow. Goodnight!",
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 20,
  });
  console.log(`  ✓ Maria After-Hours created: ${mariaAH.id}`);

  // ─── Step 4: Create Jason (Universal Design Assistant) ─────
  console.log("\n🎨 Step 4: Creating Jason (Design Team)...\n");

  const jasonTools: any[] = [tools.pushToHubspot, tools.collectMeasurements];
  if (kbTool) jasonTools.push(kbTool);

  // Add warm transfer tools for each designer
  for (const designer of DESIGNERS) {
    jasonTools.push({
      type: "transferCall",
      function: { name: `warmTransferTo${designer.name}` },
      destinations: [
        {
          type: "number",
          number: designer.phone,
          transferPlan: {
            mode: "warm-transfer-experimental",
            message: `Hi ${designer.name}, I have a caller on the line with project details ready for you. Are you available?`,
            voicemailDetectionType: "transcript",
            fallbackPlan: {
              message: `Looks like ${designer.name} is on another call right now. I'll get this info over to ${designer.name} and they'll follow up with you shortly.`,
              endCallEnabled: false,
            },
            summaryPlan: {
              enabled: true,
              messages: [
                {
                  role: "system",
                  content: `Summarize the caller's cabinet project for ${designer.name} in 2-3 sentences. Include room type, style, color, and measurements if available.`,
                },
              ],
            },
          },
        },
      ],
      messages: [
        { type: "request-start", content: `Let me see if ${designer.name} is available right now.` },
        { type: "request-failed", content: `${designer.name} isn't available right now. I'll make sure they get all your info and follow up shortly.` },
      ],
    });
  }

  const { data: jason } = await vapi.post("/assistant", {
    name: "Jason - Design Team",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.5,
      messages: [{ role: "system", content: JASON_SYSTEM_PROMPT }],
      tools: jasonTools,
    },
    voice: { provider: "vapi", voiceId: "Elliot" },
    firstMessage: JASON_FIRST_MESSAGE,
    serverUrl: WEBHOOK_URL,
    endCallMessage: "Thanks for calling Kitchen Crest! Your designer will be in touch shortly.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  });
  console.log(`  ✓ Jason created: ${jason.id}`);

  // ─── Step 5: Create Squad ─────────────────────────────────
  console.log("\n🏢 Step 5: Creating Kitchen Crest Squad (Maria + Jason)...\n");

  const { data: squad } = await vapi.post("/squad", {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: maria.id,
        assistantOverrides: {
          model: {
            provider: "openai",
            model: "gpt-4o",
            tools: [
              ...mariaTools,
              {
                type: "handoff",
                destinations: [
                  {
                    type: "assistant",
                    assistantId: jason.id,
                    description:
                      "Transfer to Jason (design team) when the caller needs design help, product questions beyond the knowledge base, wants to connect with a specific designer, or is an existing customer requesting their designer. Maria announces the transfer: 'Let me get you over to Jason on our design team.'",
                    contextEngineeringPlan: {
                      type: "userAndAssistantMessages",
                    },
                    variableExtractionPlan: {
                      variables: [
                        {
                          name: "caller_name",
                          description: "The caller's full name",
                          type: "string",
                        },
                        {
                          name: "company_name",
                          description: "The caller's company or business name",
                          type: "string",
                        },
                        {
                          name: "preferred_designer",
                          description: "The designer the caller wants to work with (Jen, Carlos, Nancy, or Derek)",
                          type: "string",
                        },
                        {
                          name: "project_type",
                          description: "The type of project: kitchen, bathroom, laundry, etc.",
                          type: "string",
                        },
                      ],
                    },
                  },
                ],
                function: {
                  name: "handoff_to_jason",
                  description:
                    "Hand off the call to Jason on the design team. Use when the caller needs design assistance, has product questions, or wants to connect with their designer.",
                },
              },
            ],
          },
        },
      },
      {
        assistantId: jason.id,
      },
    ],
  });
  console.log(`  ✓ Squad created: ${squad.id}`);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  SETUP COMPLETE — 2-Agent Architecture");
  console.log("═".repeat(60));
  console.log(`\n  Maria (Receptionist):  ${maria.id}`);
  console.log(`  Maria (After Hours):  ${mariaAH.id}`);
  console.log(`  Jason (Design Team):  ${jason.id}`);
  console.log(`  Squad:                ${squad.id}`);
  console.log(`  Knowledge Base:       ${fileIds.length} files`);
  console.log(`  Webhook:              ${WEBHOOK_URL}`);

  console.log(`\n  Add to .env:`);
  console.log(`  VAPI_MARIA_ASSISTANT_ID=${maria.id}`);
  console.log(`  VAPI_MARIA_AFTER_HOURS_ID=${mariaAH.id}`);
  console.log(`  VAPI_JASON_ASSISTANT_ID=${jason.id}`);
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
