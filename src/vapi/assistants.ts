import { DESIGNERS } from "../config/designers";
import {
  MARIA_SYSTEM_PROMPT,
  MARIA_FIRST_MESSAGE,
  MARIA_AFTER_HOURS_SYSTEM_PROMPT,
  MARIA_AFTER_HOURS_FIRST_MESSAGE,
} from "./prompts/maria";
import { JASON_SYSTEM_PROMPT, JASON_FIRST_MESSAGE } from "./prompts/jason";
import { buildToolDefinitions } from "./tools";

// ─── Maria (Main Receptionist) ─────────────────────────────────

export function buildMariaAssistant(serverUrl: string) {
  const tools = buildToolDefinitions(serverUrl);
  return {
    name: "Maria - Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "system", content: MARIA_SYSTEM_PROMPT }],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: MARIA_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [
      tools.pushToHubspot,
      tools.checkBusinessHours,
      tools.saveMessage,
    ],
    endCallMessage:
      "Thanks for calling Kitchen Crest Cabinets! Have a great day.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.5,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  };
}

// ─── Maria After-Hours ─────────────────────────────────────────

export function buildMariaAfterHoursAssistant(serverUrl: string) {
  const tools = buildToolDefinitions(serverUrl);
  return {
    name: "Maria - After Hours",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.4,
      messages: [
        { role: "system", content: MARIA_AFTER_HOURS_SYSTEM_PROMPT },
      ],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: MARIA_AFTER_HOURS_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [tools.saveMessage, tools.pushToHubspot],
    endCallMessage:
      "Thanks for calling Kitchen Crest Cabinets. We'll reach out first thing tomorrow. Goodnight!",
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 20,
  };
}

// ─── Jason (Universal Design Assistant) ────────────────────────

export function buildJasonAssistant(serverUrl: string) {
  const tools = buildToolDefinitions(serverUrl);

  // Build warm transfer tools for each designer
  const warmTransferTools = DESIGNERS.map((designer) => ({
    type: "transferCall" as const,
    function: { name: `warmTransferTo${designer.name}` },
    destinations: [
      {
        type: "number" as const,
        number: designer.phone,
        transferPlan: {
          mode: "warm-transfer-experimental",
          message: `Hi ${designer.name}, I have a caller on the line with project details ready for you. Are you available?`,
          voicemailDetectionType: "transcript",
          fallbackPlan: {
            message: `Looks like ${designer.name} is on another call right now. I'll get this info over to ${designer.name} and they'll follow up with you shortly.`,
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
        content: `Let me see if ${designer.name} is available right now.`,
      },
      {
        type: "request-failed",
        content: `${designer.name} isn't available right now. I'll make sure they get all your info and follow up shortly.`,
      },
    ],
  }));

  return {
    name: "Jason - Design Team",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.5,
      messages: [{ role: "system", content: JASON_SYSTEM_PROMPT }],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
    firstMessage: JASON_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [
      tools.pushToHubspot,
      tools.collectMeasurements,
      ...warmTransferTools,
    ],
    endCallMessage:
      "Thanks for calling Kitchen Crest! Your designer will be in touch shortly.",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
  };
}

// ─── Build All Assistants ─────────────────────────────────────

export function buildAllAssistants(serverUrl: string) {
  return {
    maria: buildMariaAssistant(serverUrl),
    mariaAfterHours: buildMariaAfterHoursAssistant(serverUrl),
    jason: buildJasonAssistant(serverUrl),
  };
}
