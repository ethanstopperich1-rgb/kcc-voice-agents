import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Main Vapi webhook — handles all event types:
 * - tool-calls: execute push_to_hubspot, collect_measurements, check_business_hours, save_message
 * - end-of-call-report: log call data (console only for demo)
 * - assistant-request: after-hours routing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body || {};
  const messageType = message?.type;

  console.log(`[Vapi] Received: ${messageType}`);

  switch (messageType) {
    case "tool-calls":
      return handleToolCalls(message, res);

    case "end-of-call-report":
      return handleEndOfCall(message, res);

    case "assistant-request":
      return handleAssistantRequest(res);

    default:
      console.log(`[Vapi] Unhandled: ${messageType}`);
      return res.status(200).json({});
  }
}

// ─── Tool Calls ──────────────────────────────────────────────

async function handleToolCalls(message: any, res: VercelResponse) {
  const toolCalls: any[] = message.toolCalls || [];
  const results: any[] = [];

  for (const toolCall of toolCalls) {
    const { id, function: fn } = toolCall;
    const args = fn.arguments || {};
    let result: any;

    switch (fn.name) {
      case "push_to_hubspot":
        console.log("[Tool] push_to_hubspot:", JSON.stringify(args));
        result = {
          success: true,
          message: "Lead data saved successfully.",
          contactId: `demo-${Date.now()}`,
        };
        break;

      case "collect_measurements":
        console.log("[Tool] collect_measurements:", JSON.stringify(args));
        result = {
          success: true,
          message: "Measurements saved.",
          saved: args,
        };
        break;

      case "check_business_hours":
        result = checkBusinessHours();
        console.log("[Tool] check_business_hours:", JSON.stringify(result));
        break;

      case "save_message":
        console.log("[Tool] save_message:", JSON.stringify(args));
        result = {
          success: true,
          message: `Message from ${args.caller_name} saved. Team will call back next business morning.`,
        };
        break;

      default:
        console.log(`[Tool] Unknown: ${fn.name}`);
        result = { error: `Unknown tool: ${fn.name}` };
    }

    results.push({ toolCallId: id, result: JSON.stringify(result) });
  }

  return res.json({ results });
}

// ─── End of Call ─────────────────────────────────────────────

async function handleEndOfCall(message: any, res: VercelResponse) {
  const { call, artifact, endedReason } = message;
  const phone = call?.customer?.number || "unknown";
  const duration = call?.startedAt && call?.endedAt
    ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    : 0;

  console.log(`[End-of-Call] Phone: ${phone} | Duration: ${duration}s | Reason: ${endedReason}`);
  console.log(`[End-of-Call] Transcript length: ${(artifact?.transcript || "").length} chars`);

  if (artifact?.recording?.url) {
    console.log(`[End-of-Call] Recording: ${artifact.recording.url}`);
  }

  return res.status(200).json({});
}

// ─── Assistant Request (After-Hours Routing) ─────────────────

function handleAssistantRequest(res: VercelResponse) {
  const hours = checkBusinessHours();

  if (hours.isOpen) {
    // Business hours — use squad
    if (process.env.VAPI_SQUAD_ID) {
      console.log("[Assistant-Request] Business hours → Squad");
      return res.json({ squadId: process.env.VAPI_SQUAD_ID });
    }
    console.log("[Assistant-Request] Business hours → Maria");
    return res.json({ assistantId: process.env.VAPI_MARIA_ASSISTANT_ID });
  }

  console.log("[Assistant-Request] After hours → Maria (After Hours)");
  return res.json({ assistantId: process.env.VAPI_MARIA_AFTER_HOURS_ID });
}

// ─── Business Hours Check ────────────────────────────────────

function checkBusinessHours(): {
  isOpen: boolean;
  currentTime: string;
  message: string;
} {
  const now = new Date();
  // Convert to Eastern Time
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = eastern.getDay(); // 0=Sun, 6=Sat
  const hour = eastern.getHours();
  const minute = eastern.getMinutes();
  const timeStr = eastern.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

  // Mon-Fri (1-5), 8:00 AM - 5:00 PM ET
  const isWeekday = day >= 1 && day <= 5;
  const isBusinessTime = (hour > 8 || (hour === 8 && minute >= 0)) && hour < 17;
  const isOpen = isWeekday && isBusinessTime;

  return {
    isOpen,
    currentTime: timeStr,
    message: isOpen
      ? "We are currently open."
      : "Our office is currently closed. Our hours are Monday through Friday, 8 AM to 5 PM Eastern Time.",
  };
}
