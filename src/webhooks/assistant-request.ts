import { Request, Response } from "express";
import { checkBusinessHours } from "../services/business-hours";

/**
 * Handle Vapi assistant-request webhook.
 *
 * This fires when an inbound call arrives and no assistant is pre-assigned.
 * We use it for after-hours routing: return a different assistantId based on
 * the current time in America/New_York timezone.
 *
 * IMPORTANT: Must respond within 7.5 seconds or Vapi will timeout.
 */
export async function handleAssistantRequest(req: Request, res: Response) {
  const { message } = req.body;

  if (message?.type !== "assistant-request") {
    return res.sendStatus(200);
  }

  const hoursCheck = checkBusinessHours();

  // Return the appropriate assistant based on business hours
  if (hoursCheck.isOpen) {
    // Business hours — use the squad (Maria + Jason)
    if (process.env.VAPI_SQUAD_ID) {
      return res.json({ squadId: process.env.VAPI_SQUAD_ID });
    }
    return res.json({ assistantId: process.env.VAPI_MARIA_ASSISTANT_ID });
  } else {
    // After hours — use Maria in after-hours mode
    return res.json({
      assistantId: process.env.VAPI_MARIA_AFTER_HOURS_ID,
    });
  }
}
