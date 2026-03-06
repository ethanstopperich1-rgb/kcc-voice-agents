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
const WEBHOOK_URL = "https://kcc-voice-agents.vercel.app/api/vapi/webhook";

async function main() {
  // Step 1: Remove the handoff tool we added directly to Maria's assistant
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  const cleanTools = (maria.model.tools || []).filter(
    (t: any) => t.type !== "handoff"
  );
  await vapi.patch(`/assistant/${MARIA_ID}`, {
    model: {
      ...maria.model,
      tools: cleanTools,
    },
  });
  console.log("✓ Removed handoff tool from Maria assistant (tools:", cleanTools.length, ")");

  // Step 2: Delete old broken squad
  try {
    await vapi.delete("/squad/2ddfe990-b665-44ad-8153-e08cdbe3cbc3");
    console.log("✓ Deleted old squad");
  } catch (e) {
    console.log("  (old squad already deleted)");
  }

  // Step 3: Create new squad — MINIMAL override matching the old working pattern
  // Only provider, model, and tools in the override. NO messages, NO temperature.
  const { data: squad } = await vapi.post("/squad", {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: MARIA_ID,
        assistantOverrides: {
          model: {
            provider: "openai",
            model: "gpt-4o",
            tools: [
              {
                type: "function",
                server: { url: WEBHOOK_URL },
                function: {
                  name: "push_to_hubspot",
                  description: "Push lead data to CRM after collecting customer info.",
                  parameters: {
                    type: "object",
                    required: ["contact_name"],
                    properties: {
                      contact_name: { type: "string" },
                      phone: { type: "string" },
                      email: { type: "string" },
                      company: { type: "string" },
                    },
                  },
                },
              },
              {
                type: "function",
                server: { url: WEBHOOK_URL },
                function: {
                  name: "check_business_hours",
                  description: "Check if Kitchen Crest Orlando office is currently open.",
                  parameters: { type: "object", properties: {} },
                },
              },
              {
                type: "function",
                server: { url: WEBHOOK_URL },
                function: {
                  name: "save_message",
                  description: "Save an after-hours message from a caller.",
                  parameters: {
                    type: "object",
                    required: ["caller_name", "callback_number", "message"],
                    properties: {
                      caller_name: { type: "string" },
                      callback_number: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
              {
                type: "handoff",
                function: {
                  name: "handoff_to_jason",
                },
                destinations: [
                  {
                    type: "assistant",
                    assistantId: JASON_ID,
                    description:
                      "Transfer to Jason on the design team when the caller needs design help, product questions, wants to connect with a specific designer, or is an existing customer requesting their designer.",
                  },
                ],
              },
            ],
          },
        },
      },
      {
        assistantId: JASON_ID,
      },
    ],
  });
  console.log("✓ New squad created:", squad.id);

  // Step 4: Assign squad to phone number (remove direct assistant assignment)
  await vapi.patch(`/phone-number/${PHONE_ID}`, {
    assistantId: null,
    squadId: squad.id,
  });
  console.log("✓ Phone number assigned to squad");

  // Verify
  const { data: phone } = await vapi.get(`/phone-number/${PHONE_ID}`);
  console.log("\nFinal phone config:");
  console.log("  Number:", phone.number);
  console.log("  Squad:", phone.squadId);
  console.log("  Assistant:", phone.assistantId || "none");

  console.log("\nNew VAPI_SQUAD_ID=" + squad.id);
}

main().catch((err) => {
  console.error("Error:", JSON.stringify(err.response?.data || err.message, null, 2));
  process.exit(1);
});
