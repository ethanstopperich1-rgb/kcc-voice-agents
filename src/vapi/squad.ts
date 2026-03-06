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
                      "Transfer to Jason (design team) when the caller needs design help, product questions beyond the knowledge base, wants to connect with a specific designer, or is an existing customer requesting their designer. Maria announces the transfer: 'Let me get you over to Jason on our design team.'",
                    contextEngineeringPlan: {
                      type: "userAndAssistantMessages" as const,
                    },
                    variableExtractionPlan: {
                      enabled: true,
                      variables: [
                        {
                          name: "caller_name",
                          description: "The caller's full name",
                          type: "string" as const,
                        },
                        {
                          name: "company_name",
                          description: "The caller's company or business name",
                          type: "string" as const,
                        },
                        {
                          name: "preferred_designer",
                          description:
                            "The designer the caller wants to work with (Jen, Carlos, Nancy, or Derek)",
                          type: "string" as const,
                        },
                        {
                          name: "project_type",
                          description:
                            "The type of project: kitchen, bathroom, laundry, etc.",
                          type: "string" as const,
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
        assistantId: assistantIds.jasonId,
      },
    ],
    artifactPlan: {
      fullMessageHistoryEnabled: true,
    },
  };
}
