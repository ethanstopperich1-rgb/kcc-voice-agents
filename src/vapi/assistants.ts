import { DESIGNERS, Designer } from "../config/designers";
import {
  ARIA_SYSTEM_PROMPT,
  ARIA_FIRST_MESSAGE,
  ARIA_AFTER_HOURS_SYSTEM_PROMPT,
  ARIA_AFTER_HOURS_FIRST_MESSAGE,
} from "./prompts/aria";
import { buildDesignerSystemPrompt, buildDesignerFirstMessage } from "./prompts/designer";
import { buildToolDefinitions } from "./tools";

// ─── Aria (Main Receptionist) ─────────────────────────────────

export function buildAriaAssistant(serverUrl: string) {
  const tools = buildToolDefinitions(serverUrl);
  return {
    name: "Aria - Main Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [{ role: "system", content: ARIA_SYSTEM_PROMPT }],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: ARIA_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: [
      "end-of-call-report",
      "tool-calls",
    ],
    tools: [
      tools.pushToHubspot,
      tools.checkBusinessHours,
      tools.saveMessage,
    ],
    endCallMessage:
      "Thank you for calling Kitchen Crest Cabinets! Have a great day.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.5,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  };
}

// ─── Aria After-Hours ─────────────────────────────────────────

export function buildAriaAfterHoursAssistant(serverUrl: string) {
  const tools = buildToolDefinitions(serverUrl);
  return {
    name: "Aria - After Hours",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [{ role: "system", content: ARIA_AFTER_HOURS_SYSTEM_PROMPT }],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: ARIA_AFTER_HOURS_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [tools.saveMessage, tools.pushToHubspot],
    endCallMessage:
      "Thank you for calling Kitchen Crest Cabinets. We'll reach out first thing tomorrow. Goodnight!",
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 20,
  };
}

// ─── Designer Assistants ──────────────────────────────────────

export function buildDesignerAssistant(
  designer: Designer,
  serverUrl: string
) {
  const tools = buildToolDefinitions(serverUrl);
  return {
    name: designer.assistantName,
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: buildDesignerSystemPrompt(designer) },
      ],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: buildDesignerFirstMessage(designer),
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [
      tools.pushToHubspot,
      tools.collectMeasurements,
      // Warm transfer to designer's cell phone
      {
        type: "transferCall" as const,
        function: { name: `warmTransferTo${designer.name}` },
        destinations: [
          {
            type: "number",
            number: designer.phone,
            transferPlan: {
              mode: "warm-transfer-experimental",
              message: `Hi ${designer.name}, I have a caller interested in Kitchen Crest cabinets. They have project details ready for you. Are you available?`,
              voicemailDetectionType: "transcript",
              fallbackPlan: {
                message: `${designer.name} is unavailable right now. They'll call you back within the hour.`,
                endCallEnabled: false,
              },
              summaryPlan: {
                enabled: true,
                messages: [
                  {
                    role: "system",
                    content: `Summarize the caller's cabinet project for ${designer.name} in 2-3 sentences. Include room type, style, color, and measurements if available.`,
                  },
                ],
              },
            },
          },
        ],
        messages: [
          {
            type: "request-start",
            content: `Let me check if ${designer.name} is available.`,
          },
          {
            type: "request-failed",
            content: `${designer.name} isn't available right now.`,
          },
        ],
      },
    ],
    endCallMessage: `Thanks for reaching out to ${designer.name}'s team at Kitchen Crest. We'll be in touch!`,
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backchannelingEnabled: true,
  };
}

// ─── Build All Assistants ─────────────────────────────────────

export function buildAllAssistants(serverUrl: string) {
  return {
    aria: buildAriaAssistant(serverUrl),
    ariaAfterHours: buildAriaAfterHoursAssistant(serverUrl),
    designers: DESIGNERS.map((d) => ({
      designer: d,
      config: buildDesignerAssistant(d, serverUrl),
    })),
  };
}
