import { DESIGNERS } from "../config/designers";

/**
 * Build the complete Vapi Squad JSON configuration.
 *
 * The squad has 1 Main Receptionist (Aria) + 5 Designer Assistants.
 * Aria is always the first member (entry point for all calls).
 * Each designer assistant is available for handoff when triggered.
 */
export function buildSquadConfig(assistantIds: {
  ariaId: string;
  designerIds: Record<string, string>; // { "Jen": "asst_xxx", ... }
}) {
  // Build handoff destinations from Aria to each designer
  const handoffDestinations = DESIGNERS.map((d) => ({
    type: "assistant" as const,
    assistantId: assistantIds.designerIds[d.name],
    description: `Transfer when caller asks for ${d.name}, says "my designer" and ${d.name} is their preferred designer, or when CRM lookup identifies them as ${d.name}'s client. Trigger SILENTLY — do NOT say "I'm transferring you."`,
  }));

  return {
    name: "Kitchen Crest Cabinet Squad",
    members: [
      {
        assistantId: assistantIds.ariaId,
        assistantOverrides: {
          model: {
            tools: [
              {
                type: "handoff",
                destinations: handoffDestinations,
                function: { name: "handoff_to_designer" },
              },
            ],
          },
        },
      },
      // Each designer assistant as a squad member
      ...DESIGNERS.map((d) => ({
        assistantId: assistantIds.designerIds[d.name],
      })),
    ],
    memberOverrides: {
      voice: { provider: "vapi", voiceId: "Elliot" },
    },
  };
}

/**
 * Returns the squad JSON that can be used for creating a squad via Vapi API.
 * Uses placeholder IDs — replace after provisioning assistants.
 */
export function buildSquadTemplate() {
  const placeholders: Record<string, string> = {};
  DESIGNERS.forEach((d) => {
    placeholders[d.name] = `PLACEHOLDER_${d.name.toUpperCase()}_ID`;
  });

  return buildSquadConfig({
    ariaId: "PLACEHOLDER_ARIA_ID",
    designerIds: placeholders,
  });
}
