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
  // Step 1: Delete existing squad
  try {
    await vapi.delete("/squad/924c7e43-454c-4cf3-b3a8-dfda6da9bbb8");
    console.log("Deleted old squad");
  } catch (e) {
    console.log("(old squad already gone)");
  }

  // Step 2: Get Maria's full config to understand what we're working with
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  console.log("Maria model keys:", Object.keys(maria.model));
  console.log("Maria model.tools types:", maria.model.tools?.map((t: any) => t.type));

  // Step 3: The old working squad used inline assistants, not assistantId refs.
  // Let's try using inline assistant configs instead of assistantId + overrides.
  // This avoids any merge issues.

  const { data: jason } = await vapi.get(`/assistant/${JASON_ID}`);

  const { data: squad } = await vapi.post("/squad", {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        // Use inline assistant config — no merge issues
        assistant: {
          name: "Maria - Receptionist",
          model: {
            provider: "openai",
            model: "gpt-4o",
            temperature: 0.4,
            messages: maria.model.messages,
            tools: [
              // Include Maria's existing function tools
              ...maria.model.tools.filter((t: any) => t.type === "function" || t.type === "query"),
              // Add the handoff
              {
                type: "handoff",
                function: {
                  name: "handoff_to_jason",
                },
                destinations: [
                  {
                    type: "assistant",
                    assistantName: "Jason - Design Team",
                    description:
                      "Transfer to Jason on the design team when the caller needs design help, product questions, wants to connect with a specific designer, or is an existing customer requesting their designer.",
                  },
                ],
              },
            ],
          },
          voice: {
            provider: "rime-ai",
            voiceId: "mesa_extra",
            model: "mistv2",
          },
          firstMessage: maria.firstMessage,
          serverUrl: WEBHOOK_URL,
          endCallMessage: maria.endCallMessage,
          maxDurationSeconds: 600,
          silenceTimeoutSeconds: 30,
          responseDelaySeconds: 0.5,
          backchannelingEnabled: true,
          backgroundDenoisingEnabled: true,
        },
      },
      {
        // Jason as inline too
        assistant: {
          name: "Jason - Design Team",
          model: {
            provider: "openai",
            model: "gpt-4o",
            temperature: 0.5,
            messages: jason.model.messages,
            tools: jason.model.tools,
          },
          voice: {
            provider: "rime-ai",
            voiceId: "walnut",
            model: "arcana",
          },
          firstMessage: jason.firstMessage,
          serverUrl: WEBHOOK_URL,
          endCallMessage: jason.endCallMessage,
          maxDurationSeconds: 600,
          silenceTimeoutSeconds: 30,
          backchannelingEnabled: true,
          backgroundDenoisingEnabled: true,
        },
      },
    ],
  });
  console.log("New squad created:", squad.id);

  // Step 4: Assign to phone — remove serverUrl to avoid assistant-request interference
  await vapi.patch(`/phone-number/${PHONE_ID}`, {
    assistantId: null,
    squadId: squad.id,
    serverUrl: null,
  });
  console.log("Phone number assigned to squad (serverUrl cleared)");

  // Verify
  const { data: phone } = await vapi.get(`/phone-number/${PHONE_ID}`);
  console.log("\nPhone:", phone.number);
  console.log("  Squad:", phone.squadId);
  console.log("  Assistant:", phone.assistantId || "none");
  console.log("  ServerUrl:", phone.serverUrl || "none");

  console.log("\nVAPI_SQUAD_ID=" + squad.id);
}

main().catch((err) => {
  console.error("Error:", JSON.stringify(err.response?.data || err.message, null, 2));
  process.exit(1);
});
