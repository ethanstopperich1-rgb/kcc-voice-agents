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
  // Get Maria current config
  const { data: maria } = await vapi.get(`/assistant/${MARIA_ID}`);
  const existingTools: any[] = maria.model.tools || [];

  // Check if handoff already exists
  const hasHandoff = existingTools.some((t) => t.type === "handoff");
  console.log("Existing tools:", existingTools.length, "Has handoff:", hasHandoff);

  if (hasHandoff === false) {
    // Add handoff tool directly to Maria assistant
    const updatedTools = [
      ...existingTools,
      {
        type: "handoff",
        destinations: [
          {
            type: "assistant",
            assistantId: JASON_ID,
            description:
              "Transfer to Jason on the design team when the caller needs design help, product questions, wants to connect with a specific designer, or is an existing customer requesting their designer.",
          },
        ],
        function: {
          name: "handoff_to_jason",
          description:
            "Hand off the call to Jason on the design team for design assistance, product questions, or designer connection.",
        },
      },
    ];

    await vapi.patch(`/assistant/${MARIA_ID}`, {
      model: {
        ...maria.model,
        tools: updatedTools,
      },
    });
    console.log("Added handoff tool to Maria assistant");
  }

  // Assign Maria directly to the phone number (no squad)
  const { data: updated } = await vapi.patch(`/phone-number/${PHONE_ID}`, {
    squadId: null,
    assistantId: MARIA_ID,
  });
  console.log("Phone number updated:");
  console.log("  assistantId:", updated.assistantId);
  console.log("  squadId:", updated.squadId);
}

main().catch((err) => {
  console.error("Error:", JSON.stringify(err.response?.data || err.message, null, 2));
  process.exit(1);
});
