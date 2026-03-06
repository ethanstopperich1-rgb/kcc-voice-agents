/**
 * Build the complete Vapi Squad JSON configuration.
 *
 * Architecture: 2-agent squad
 * - Maria (Receptionist) — entry point for all calls
 * - Jason (Universal Design Assistant) — handles existing customer inquiries
 *
 * Maria hands off to Jason when an existing customer needs design help,
 * order questions, or wants to speak with their designer.
 *
 * IMPORTANT: Handoff uses `assistantDestinations` on the squad member —
 * NOT model.tools, NOT tools:append, NOT handoff tools on the base assistant.
 * Vapi auto-generates a transferCall tool from assistantDestinations that
 * it fully controls for squad-level transfers.
 *
 * What DOESN'T work (learned the hard way):
 * - tools:append in assistantOverrides → stored in config but LLM never sees the tool
 * - handoff tool on base assistant → LLM calls it, returns "Handoff initiated" text,
 *   but Vapi doesn't process it as a squad transfer (Transfers: NONE, Nodes: 0)
 *
 * What WORKS:
 * - assistantDestinations on squad member → Vapi generates a transferCall tool,
 *   LLM sees it, calls it, and Vapi processes it as a real squad transfer
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
        // assistantDestinations auto-generates a transferCall tool
        // that Vapi fully controls for squad-level transfers
        assistantDestinations: [
          {
            type: "assistant" as const,
            assistantName: "Jason - Design Team", // Must match Jason's assistant name exactly
            message: "", // Silent transition — Jason has his own firstMessage
            description:
              "Transfer to Jason on the design team when an existing customer needs help with design, orders, or wants to speak with their designer.",
          },
        ],
      },
      {
        assistantId: assistantIds.jasonId,
        // No destinations — Jason doesn't transfer back to Maria
      },
    ],
  };
}
