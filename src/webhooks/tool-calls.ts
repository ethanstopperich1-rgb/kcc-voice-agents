import { Request, Response } from "express";
import { checkBusinessHours } from "../services/business-hours";
import * as hubspot from "../services/hubspot";

/**
 * Handle Vapi tool-calls webhook.
 * Vapi sends tool call requests here; we execute the function and return results.
 */
export async function handleToolCalls(req: Request, res: Response) {
  const { message } = req.body;

  if (message?.type !== "tool-calls") {
    return res.sendStatus(200);
  }

  const toolCalls: any[] = message.toolCalls || [];
  const results: any[] = [];

  for (const toolCall of toolCalls) {
    const { id, function: fn } = toolCall;
    const args = fn.arguments || {};

    try {
      let result: any;

      switch (fn.name) {
        case "push_to_hubspot":
          result = await handlePushToHubspot(args, message);
          break;

        case "collect_measurements":
          result = await handleCollectMeasurements(args, message);
          break;

        case "check_business_hours":
          result = checkBusinessHours();
          break;

        case "save_message":
          result = await handleSaveMessage(args, message);
          break;

        default:
          result = { error: `Unknown tool: ${fn.name}` };
      }

      results.push({
        toolCallId: id,
        result: JSON.stringify(result),
      });
    } catch (err: any) {
      console.error(`Tool call error (${fn.name}):`, err.message);
      results.push({
        toolCallId: id,
        error: `Failed to execute ${fn.name}: ${err.message}`,
      });
    }
  }

  return res.json({ results });
}

// ─── Tool Handlers ───────────────────────────────────────────

async function handlePushToHubspot(
  args: any,
  message: any
): Promise<{ success: boolean; contactId?: string; isNew?: boolean }> {
  const phone =
    args.phone || message.call?.customer?.number || "";
  const nameParts = (args.contact_name || "").split(" ");
  const firstname = nameParts[0] || "";
  const lastname = nameParts.slice(1).join(" ") || "";

  const properties: Record<string, string> = {};
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (args.email) properties.email = args.email;
  if (args.company) properties.company = args.company;
  if (args.project_type) properties.project_type = args.project_type;
  if (args.ceiling_height)
    properties.ceiling_height_inches = String(args.ceiling_height);
  if (args.wall_count) properties.wall_count = String(args.wall_count);
  if (args.linear_feet)
    properties.kitchen_total_linear_feet = String(args.linear_feet);
  if (args.style_preference)
    properties.cabinet_style_preference = args.style_preference;
  if (args.appliance_cutouts)
    properties.appliance_cutouts = args.appliance_cutouts;
  if (args.cabinet_count_base)
    properties.cabinet_count_base = String(args.cabinet_count_base);
  if (args.cabinet_count_upper)
    properties.cabinet_count_upper = String(args.cabinet_count_upper);
  if (args.budget_range) properties.budget_range = args.budget_range;
  if (args.preferred_designer)
    properties.preferred_designer = args.preferred_designer;

  properties.recording_consent_given = "true";
  properties.last_ai_call_date = new Date().toISOString().split("T")[0];

  const { contact, isNew } = await hubspot.findOrCreateContact(
    phone,
    properties
  );

  console.log(
    `[HubSpot] ${isNew ? "Created" : "Updated"} contact ${contact.id} (${phone})`
  );

  return { success: true, contactId: contact.id, isNew };
}

async function handleCollectMeasurements(
  args: any,
  message: any
): Promise<{ success: boolean; saved: Record<string, any> }> {
  // Measurements are collected and pushed to HubSpot as contact properties
  const phone = message.call?.customer?.number || "";

  const properties: Record<string, string> = {};
  if (args.ceiling_height_ft)
    properties.ceiling_height_inches = String(args.ceiling_height_ft * 12);
  if (args.length_ft && args.width_ft)
    properties.kitchen_total_linear_feet = String(
      (args.length_ft + args.width_ft) * 2
    );
  if (args.cabinet_style)
    properties.cabinet_style_preference = args.cabinet_style.toLowerCase();
  if (args.cabinet_color)
    properties.cabinet_style_preference += ` - ${args.cabinet_color}`;
  if (args.appliance_cutouts)
    properties.appliance_cutouts = Array.isArray(args.appliance_cutouts)
      ? args.appliance_cutouts.join(", ")
      : args.appliance_cutouts;

  if (phone && Object.keys(properties).length > 0) {
    const existing = await hubspot.searchContactByPhone(phone);
    if (existing) {
      await hubspot.updateContact(existing.id, properties);
    }
  }

  console.log(`[Measurements] Saved for ${phone}:`, args);
  return { success: true, saved: args };
}

async function handleSaveMessage(
  args: any,
  message: any
): Promise<{ success: boolean; message: string }> {
  const phone =
    args.callback_number || message.call?.customer?.number || "";

  // Create or update contact with the message
  const { contact } = await hubspot.findOrCreateContact(phone, {
    firstname: args.caller_name?.split(" ")[0] || "",
    lastname: args.caller_name?.split(" ").slice(1).join(" ") || "",
  });

  // Create a note with the after-hours message
  await hubspot.createNote(
    contact.id,
    `📞 After-Hours Message\n\nCaller: ${args.caller_name}\nCallback: ${phone}\nMessage: ${args.message}\n\nReceived via Voxaris AI at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`
  );

  // Create a follow-up task for next morning
  await hubspot.createFollowUpTask({
    contactId: contact.id,
    subject: `Callback: ${args.caller_name} (after-hours message)`,
    body: `After-hours message: ${args.message}\nCallback number: ${phone}`,
    priority: "HIGH",
  });

  console.log(`[After-Hours] Saved message from ${args.caller_name} (${phone})`);
  return {
    success: true,
    message: `Message saved. Team will call back next business morning.`,
  };
}
