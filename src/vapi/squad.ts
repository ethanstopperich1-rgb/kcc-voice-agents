/**
 * Build the complete Vapi Squad JSON configuration.
 *
 * Architecture: 2-agent squad
 * - Maria (Receptionist) — entry point for all calls
 * - Jason (Universal Design Assistant) — handles all designer-related intake
 *
 * Maria hands off to Jason when callers need design help, product questions,
 * or want to connect with a specific designer. Jason handles all designers.
 *
 * Key features:
 * - contextEngineeringPlan: passes only user/assistant messages (no tool noise)
 * - variableExtractionPlan: extracts structured data before handoff
 * - artifactPlan: full message history for debugging
 */
export function buildSquadConfig(assistantIds: {
  mariaId: string;
  jasonId: string;
}) {
  return {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: assistantIds.mariaId,
        assistantOverrides: {
          model: {
            tools: [
              {
                type: "handoff",
                destinations: [
                  {
                    type: "assistant" as const,
                    assistantId: assistantIds.jasonId,
                    description:
                      "Transfer to Jason on the design team when the caller needs design help, product questions, wants to connect with a specific designer, or is an existing customer requesting their designer.",
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
        assistantId: assistantIds.jasonId,
      },
    ],
  };
}
