import { Router } from "express";
import { handleToolCalls } from "./tool-calls";
import { handleEndOfCall } from "./end-of-call";
import { handleAssistantRequest } from "./assistant-request";

const router = Router();

/**
 * Main Vapi webhook endpoint.
 * Routes incoming Vapi events to the appropriate handler based on message type.
 */
router.post("/webhook", async (req, res) => {
  const messageType = req.body?.message?.type;

  console.log(`[Vapi] Received: ${messageType}`);

  switch (messageType) {
    case "tool-calls":
      return handleToolCalls(req, res);

    case "end-of-call-report":
      return handleEndOfCall(req, res);

    case "assistant-request":
      return handleAssistantRequest(req, res);

    default:
      // Acknowledge unknown event types gracefully
      console.log(`[Vapi] Unhandled event: ${messageType}`);
      return res.sendStatus(200);
  }
});

/**
 * Direct tool-calls endpoint (alternative URL for tool server config).
 */
router.post("/tool-calls", handleToolCalls);

export default router;
