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
      provider: "rime-ai",
      voiceId: "lagoon",
      model: "mistv2",
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
      "Thank you so much for choosing Kitchen Crest Cabinets, have a great day!",
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
      provider: "rime-ai",
      voiceId: "lagoon",
      model: "mistv2",
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

  // NOTE: Jason does NOT have a transferCall tool for designers.
  // Per the prompt, Jason always tells callers the designer isn't available
  // and proactively helps collect info / answer questions himself.
  // He pushes everything to HubSpot and the designer follows up.

  return {
    name: "Jason - Design Team",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.5,
      messages: [{ role: "system", content: JASON_SYSTEM_PROMPT }],
    },
    voice: {
      provider: "rime-ai",
      voiceId: "walnut",
      model: "arcana",
    },
    firstMessage: JASON_FIRST_MESSAGE,
    serverUrl: `${serverUrl}/vapi/webhook`,
    serverMessages: ["end-of-call-report", "tool-calls"],
    tools: [
      tools.pushToHubspot,
      tools.collectMeasurements,
    ],
    endCallMessage:
      "Thank you so much for choosing Kitchen Crest Cabinets, have a great day!",
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
