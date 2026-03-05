import { Request, Response } from "express";
import * as hubspot from "../services/hubspot";

/**
 * Handle Vapi end-of-call-report webhook.
 * Fires when a call ends — push transcript, recording, and summary to HubSpot.
 */
export async function handleEndOfCall(req: Request, res: Response) {
  const { message } = req.body;

  if (message?.type !== "end-of-call-report") {
    return res.sendStatus(200);
  }

  const { call, artifact, endedReason } = message;
  const phone = call?.customer?.number;

  if (!phone) {
    console.warn("[End-of-Call] No customer phone number — skipping");
    return res.sendStatus(200);
  }

  try {
    const transcript = artifact?.transcript || "";
    const recordingUrl = artifact?.recording?.url || "";
    const summary = artifact?.messages
      ?.filter((m: any) => m.role === "assistant")
      ?.map((m: any) => m.message)
      ?.join(" ")
      ?.slice(0, 500) || "";

    const startedAt = call.startedAt || new Date().toISOString();
    const endedAt = call.endedAt || new Date().toISOString();
    const durationMs =
      new Date(endedAt).getTime() - new Date(startedAt).getTime();

    // 1. Find or create contact
    const { contact, isNew } = await hubspot.findOrCreateContact(phone, {
      ai_call_summary: summary.slice(0, 500),
      ai_call_recording_url: recordingUrl,
      ai_call_transcript: transcript.slice(0, 10000),
      last_ai_call_date: new Date().toISOString().split("T")[0],
      recording_consent_given: "true",
    });

    console.log(
      `[End-of-Call] Processing for contact ${contact.id} (${isNew ? "new" : "existing"})`
    );

    // 2. Log call engagement
    await hubspot.logCallEngagement({
      contactId: contact.id,
      startedAt,
      transcript: transcript.slice(0, 10000),
      durationMs,
      recordingUrl,
      summary,
    });

    // 3. Create note with full transcript
    const noteBody = [
      `🤖 Voxaris AI Call — ${new Date(startedAt).toLocaleString("en-US", { timeZone: "America/New_York" })}`,
      `Duration: ${Math.round(durationMs / 1000)}s | Ended: ${endedReason}`,
      recordingUrl ? `Recording: ${recordingUrl}` : "",
      "",
      "--- Transcript ---",
      transcript || "(no transcript available)",
    ]
      .filter(Boolean)
      .join("\n");

    await hubspot.createNote(contact.id, noteBody);

    // 4. Create follow-up task
    const contactName =
      [
        contact.properties?.firstname,
        contact.properties?.lastname,
      ]
        .filter(Boolean)
        .join(" ") || phone;

    await hubspot.createFollowUpTask({
      contactId: contact.id,
      subject: `Follow up: ${contactName}`,
      body: `AI call completed. ${summary.slice(0, 200)}`,
    });

    // 5. Create deal if this is a new lead
    if (isNew) {
      await hubspot.createDeal({
        contactId: contact.id,
        dealName: `Cabinet Project - ${contactName}`,
      });
      console.log(`[End-of-Call] Created deal for new lead ${contactName}`);
    }

    console.log(
      `[End-of-Call] Complete — contact=${contact.id}, duration=${Math.round(durationMs / 1000)}s`
    );
  } catch (err: any) {
    console.error("[End-of-Call] Error:", err.message);
  }

  return res.sendStatus(200);
}
