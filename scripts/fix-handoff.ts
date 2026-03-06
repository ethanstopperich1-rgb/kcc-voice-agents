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

async function main() {
  // Step 1: Add handoff tool directly to Maria's base assistant
  console.log("Step 1: Adding handoff tool to Maria base config...");
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  const currentTools: any[] = maria.model?.tools || [];

  // Remove any existing handoff tools
  const cleanTools = currentTools.filter((t: any) => t.type !== "handoff");

  // Add the handoff tool with explicit instruction to CALL the tool
  const handoffTool = {
    type: "handoff",
    function: {
      name: "handoff_to_jason",
      description:
        "Hand off the call to Jason on the design team. You MUST call this tool to perform the transfer — just saying you will transfer is not enough.",
    },
    destinations: [
      {
        type: "assistant",
        assistantId: JASON_ID,
        description:
          "Transfer to Jason on the design team for existing customer inquiries — design help, order questions, or when they want to speak with their designer.",
        contextEngineeringPlan: { type: "all" },
      },
    ],
  };

  const updatedTools = [...cleanTools, handoffTool];

  await vapi.patch(`/assistant/${MARIA_ID}`, {
    model: {
      ...maria.model,
      tools: updatedTools,
    },
  });
  console.log(
    "  Maria now has",
    updatedTools.length,
    "tools (added handoff to base)"
  );

  // Step 2: Delete current squad
  console.log("\nStep 2: Deleting old squads...");
  const { data: allSquads } = await vapi.get("/squad");
  for (const sq of allSquads) {
    if (sq.name === "Kitchen Crest Cabinet Squad") {
      try {
        await vapi.delete(`/squad/${sq.id}`);
        console.log("  Deleted:", sq.id);
      } catch (e) {
        console.log("  (skip:", sq.id, ")");
      }
    }
  }

  // Step 3: Create new squad with assistantDestinations as backup
  console.log("\nStep 3: Creating new squad...");

  const { data: jason } = await vapi.get(`/assistant/${JASON_ID}`);

  const { data: squad } = await vapi.post("/squad", {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: MARIA_ID,
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: jason.name,
            message: "",
            description:
              "Transfer to Jason on the design team for existing customer inquiries.",
          },
        ],
      },
      {
        assistantId: JASON_ID,
      },
    ],
  });
  console.log("  Squad created:", squad.id);

  // Step 4: Assign to phone
  console.log("\nStep 4: Assigning to phone...");
  await vapi.patch(`/phone-number/${PHONE_ID}`, {
    assistantId: null,
    squadId: squad.id,
    serverUrl: null,
  });
  console.log("  Phone assigned");

  // Verify
  const { data: mariaV } = await vapi.get(`/assistant/${MARIA_ID}`);
  const mTools: any[] = mariaV.model?.tools || [];
  const hasHandoff = mTools.some((t: any) => t.type === "handoff");
  console.log("\n=== VERIFICATION ===");
  console.log("Maria tools:", mTools.length, "(has handoff:", hasHandoff, ")");
  console.log(
    "Maria tool types:",
    mTools.map((t: any) => t.type + ":" + (t.function?.name || "?"))
  );
  console.log("Squad:", squad.id);
  console.log("\nVAPI_SQUAD_ID=" + squad.id);
  console.log("\nReady to test!");
}

main().catch((err) => {
  console.error(
    "Error:",
    JSON.stringify(err.response?.data || err.message, null, 2)
  );
  process.exit(1);
});
