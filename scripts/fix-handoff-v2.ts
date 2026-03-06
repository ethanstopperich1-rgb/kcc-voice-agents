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
  console.log("=== FIX HANDOFF V2 — assistantDestinations only ===\n");
  console.log("Root cause: handoff tool on base assistant fires but Vapi");
  console.log("doesn't process it as a squad transfer. Only squad-level");
  console.log("mechanisms (assistantDestinations) trigger real transfers.\n");

  // Step 1: Remove handoff tool from Maria's base assistant
  console.log("Step 1: Remove handoff from Maria base...");
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  const currentTools: any[] = maria.model?.tools || [];
  const cleanTools = currentTools.filter((t) => t.type !== "handoff");

  if (cleanTools.length !== currentTools.length) {
    await vapi.patch(`/assistant/${MARIA_ID}`, {
      model: {
        ...maria.model,
        tools: cleanTools,
      },
    });
    console.log(
      `  Removed handoff (${currentTools.length} → ${cleanTools.length} tools)`
    );
  } else {
    console.log("  No handoff to remove");
  }

  // Step 2: Delete old squads
  console.log("\nStep 2: Delete old squads...");
  const { data: allSquads } = await vapi.get("/squad");
  for (const sq of allSquads) {
    if (sq.name === "Kitchen Crest Cabinet Squad") {
      try {
        await vapi.delete(`/squad/${sq.id}`);
        console.log(`  Deleted: ${sq.id}`);
      } catch (e) {
        console.log(`  (skip: ${sq.id})`);
      }
    }
  }

  // Step 3: Get Jason's name for assistantDestinations matching
  const { data: jason } = await vapi.get(`/assistant/${JASON_ID}`);
  console.log(`\n  Jason assistant name: "${jason.name}"`);

  // Step 4: Create squad with ONLY assistantDestinations
  console.log("\nStep 3: Create squad with assistantDestinations...");

  const squadPayload = {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: MARIA_ID,
        // assistantDestinations auto-generates a transferCall tool
        // that Vapi fully controls for squad-level transfers
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: jason.name, // Must match exactly
            message: "", // Silent transition — Jason has his own firstMessage
            description:
              "Transfer to Jason on the design team when an existing customer needs help with design, orders, or wants to speak with their designer.",
          },
        ],
      },
      {
        assistantId: JASON_ID,
        // No destinations — Jason doesn't transfer back to Maria
      },
    ],
  };

  console.log("  Payload:", JSON.stringify(squadPayload, null, 2));

  const { data: squad } = await vapi.post("/squad", squadPayload);
  console.log(`\n  Squad created: ${squad.id}`);

  // Step 5: Assign to phone
  console.log("\nStep 4: Assign to phone...");
  await vapi.patch(`/phone-number/${PHONE_ID}`, {
    assistantId: null,
    squadId: squad.id,
    serverUrl: null,
  });
  console.log("  Done");

  // Verify
  console.log("\n=== VERIFICATION ===");
  const { data: mariaV } = await vapi.get(`/assistant/${MARIA_ID}`);
  const mTools: any[] = mariaV.model?.tools || [];
  const hasHandoff = mTools.some((t) => t.type === "handoff");
  console.log(
    `Maria tools: ${mTools.length} [${mTools.map((t) => t.type).join(", ")}]`
  );
  console.log(`Maria has handoff on base: ${hasHandoff} (should be false)`);

  const { data: squadV } = await vapi.get(`/squad/${squad.id}`);
  for (let i = 0; i < squadV.members.length; i++) {
    const m = squadV.members[i];
    const dests = m.assistantDestinations || [];
    console.log(
      `Squad member [${i}]: assistantId=${m.assistantId}, destinations=${dests.length}`
    );
    for (const d of dests) {
      console.log(`  → ${d.assistantName} (${d.type})`);
    }
  }

  console.log(`\nVAPI_SQUAD_ID=${squad.id}`);
  console.log(`\nReady to test!`);
}

main().catch((err) => {
  console.error(
    "\nError:",
    JSON.stringify(err.response?.data || err.message, null, 2)
  );
  process.exit(1);
});
