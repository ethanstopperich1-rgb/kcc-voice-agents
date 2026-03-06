import "dotenv/config";
import axios from "axios";

const vapi = axios.create({
  baseURL: "https://api.vapi.ai",
  headers: {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
});

const MARIA_ID = "46bc8400-9235-49b8-aa4f-59a17382d42f";
const JASON_ID = "ea9179da-6a4f-4df1-8e55-c5fc1a50cb43";
const PHONE_ID = "9d19acf5-d001-436e-8f31-91d271d39e43";

const DESIGNERS = [
  { name: "Jen", phone: "+14075551001" },
  { name: "Carlos", phone: "+14075551002" },
  { name: "Nancy", phone: "+14075551003" },
  { name: "Derek", phone: "+14075551005" },
];

async function main() {
  console.log("=== FIX SQUAD V3 — DEFINITIVE FIX ===\n");
  console.log("Root causes found:");
  console.log("  1) Jason has 4 transferCall tools — Vapi allows max 1 per assistant in a squad");
  console.log("  2) Handoff tool was in model.tools override — must use tools:append");
  console.log("  3) contextEngineeringPlan was missing from handoff destination\n");

  // ─── Step 1: Fetch current state ─────────────────────────────
  console.log("Step 1: Fetching current assistant configs...");
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  const { data: jason } = await vapi.get(`/assistant/${JASON_ID}`);

  const mariaTools: any[] = maria.model?.tools || [];
  const jasonTools: any[] = jason.model?.tools || [];

  console.log(`  Maria: ${mariaTools.length} tools [${mariaTools.map((t: any) => t.type + ':' + (t.function?.name || '?')).join(', ')}]`);
  console.log(`  Jason: ${jasonTools.length} tools [${jasonTools.map((t: any) => t.type + ':' + (t.function?.name || '?')).join(', ')}]`);

  const jasonTransferCount = jasonTools.filter((t: any) => t.type === "transferCall").length;
  console.log(`  Jason transferCall count: ${jasonTransferCount} (max 1 allowed in squad)\n`);

  // ─── Step 2: Fix Jason — merge N transferCall tools into 1 ───
  console.log("Step 2: Merging Jason's transferCall tools into 1...");

  const jasonNonTransferTools = jasonTools.filter((t: any) => t.type !== "transferCall");

  const singleTransferTool = {
    type: "transferCall",
    function: {
      name: "transferToDesigner",
      description:
        "Transfer the caller to a specific Kitchen Crest designer for a warm handoff. Choose the right designer based on the caller's preference or the conversation context.",
    },
    destinations: DESIGNERS.map((d) => ({
      type: "number",
      number: d.phone,
      description: `Transfer to designer ${d.name}`,
      transferPlan: {
        mode: "warm-transfer-experimental",
        message: `Hi ${d.name}, I have a caller on the line with project details ready for you. Are you available?`,
        sipVerb: "refer",
        fallbackPlan: {
          message: `${d.name} isn't available right now. I'll make sure they get your info and follow up shortly.`,
          endCallEnabled: false,
        },
        summaryPlan: {
          enabled: true,
          messages: [
            {
              role: "system",
              content: `Summarize the caller's cabinet project for ${d.name} in 2-3 sentences. Include room type, style, color, and measurements if available.`,
            },
          ],
        },
      },
    })),
    messages: [
      {
        type: "request-start",
        content: "Let me connect you with your designer now.",
      },
      {
        type: "request-failed",
        content:
          "They're not available right now, but I'll make sure they get all your information and follow up shortly.",
      },
    ],
  };

  const updatedJasonTools = [...jasonNonTransferTools, singleTransferTool];

  await vapi.patch(`/assistant/${JASON_ID}`, {
    model: {
      ...jason.model,
      tools: updatedJasonTools,
    },
  });
  console.log(
    `  Merged ${jasonTransferCount} transferCall → 1 tool with ${DESIGNERS.length} destinations`
  );
  console.log(`  Jason now has ${updatedJasonTools.length} tools total\n`);

  // ─── Step 3: Clean Maria — remove any stray handoff tools ────
  console.log("Step 3: Cleaning Maria's base config...");

  const mariaHasHandoff = mariaTools.some((t: any) => t.type === "handoff");
  if (mariaHasHandoff) {
    const cleanedMariaTools = mariaTools.filter(
      (t: any) => t.type !== "handoff"
    );
    await vapi.patch(`/assistant/${MARIA_ID}`, {
      model: { ...maria.model, tools: cleanedMariaTools },
    });
    console.log("  Removed handoff from Maria base config\n");
  } else {
    console.log("  Maria is clean (no handoff on base)\n");
  }

  // ─── Step 4: Delete ALL old Kitchen Crest squads ─────────────
  console.log("Step 4: Deleting old squads...");

  const { data: allSquads } = await vapi.get("/squad");
  let deleted = 0;
  for (const sq of allSquads) {
    if (sq.name === "Kitchen Crest Cabinet Squad") {
      try {
        await vapi.delete(`/squad/${sq.id}`);
        console.log(`  Deleted: ${sq.id}`);
        deleted++;
      } catch (e) {
        console.log(`  (skip: ${sq.id})`);
      }
    }
  }
  console.log(`  ${deleted} squads deleted\n`);

  // ─── Step 5: Create squad with tools:append (correct way) ────
  console.log("Step 5: Creating new squad with tools:append...");

  const squadPayload = {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: MARIA_ID,
        assistantOverrides: {
          // tools:append ADDS the handoff to Maria's existing tools
          // instead of replacing model.tools (which was the bug)
          "tools:append": [
            {
              type: "handoff",
              function: {
                name: "handoff_to_jason",
                description:
                  "Hand off the call to Jason on the design team. Use when the caller needs design assistance, has product questions, or wants to connect with their designer.",
              },
              destinations: [
                {
                  type: "assistant",
                  assistantId: JASON_ID,
                  description:
                    "Transfer to Jason on the design team when the caller needs design help, product questions, wants to connect with a specific designer, or is an existing customer requesting their designer.",
                  // Pass full conversation context so Jason knows what Maria discussed
                  contextEngineeringPlan: { type: "all" },
                },
              ],
            },
          ],
        },
      },
      {
        assistantId: JASON_ID,
        // No overrides needed — Jason's base config already has
        // the merged single transferCall tool + function tools + KB
      },
    ],
  };

  console.log("  Payload:", JSON.stringify(squadPayload, null, 2));

  const { data: squad } = await vapi.post("/squad", squadPayload);
  console.log(`\n  Squad created: ${squad.id}\n`);

  // ─── Step 6: Assign squad to phone number ────────────────────
  console.log("Step 6: Assigning squad to phone...");

  await vapi.patch(`/phone-number/${PHONE_ID}`, {
    assistantId: null,
    squadId: squad.id,
    serverUrl: null, // Clear to prevent assistant-request webhook interference
  });
  console.log("  Phone → squad, serverUrl cleared\n");

  // ─── Verification ──────────────────────────────────────────
  console.log("=== VERIFICATION ===\n");

  const { data: phone } = await vapi.get(`/phone-number/${PHONE_ID}`);
  const { data: jasonV } = await vapi.get(`/assistant/${JASON_ID}`);
  const jasonVTools: any[] = jasonV.model?.tools || [];
  const tcCount = jasonVTools.filter(
    (t: any) => t.type === "transferCall"
  ).length;

  console.log(`Phone: ${phone.number}`);
  console.log(`  squadId:     ${phone.squadId}`);
  console.log(`  assistantId: ${phone.assistantId || "none"}`);
  console.log(`  serverUrl:   ${phone.serverUrl || "none"}`);
  console.log(`\nJason transferCall count: ${tcCount} (must be 1)`);
  console.log(`Jason total tools: ${jasonVTools.length}`);

  if (tcCount !== 1) {
    console.error("\n⚠️  WARNING: Jason still has != 1 transferCall tools!");
  }
  if (phone.squadId !== squad.id) {
    console.error("\n⚠️  WARNING: Phone not pointing to new squad!");
  }

  console.log(`\n✅ VAPI_SQUAD_ID=${squad.id}`);
  console.log(`\nCall (407) 289-0294 to test!`);
}

main().catch((err) => {
  console.error(
    "\n❌ Error:",
    JSON.stringify(err.response?.data || err.message, null, 2)
  );
  process.exit(1);
});
