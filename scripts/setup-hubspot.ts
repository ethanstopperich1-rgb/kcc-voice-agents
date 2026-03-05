/**
 * HubSpot Setup Script
 *
 * Creates custom properties and pipeline for Kitchen Crest cabinet sales.
 * Run: npx tsx scripts/setup-hubspot.ts
 */
import "dotenv/config";
import { createCustomProperty, createPipeline } from "../src/services/hubspot";

async function main() {
  console.log("\n🔧 Kitchen Crest — HubSpot Setup\n");

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error("Missing HUBSPOT_ACCESS_TOKEN in .env");
    process.exit(1);
  }

  // ─── Step 1: Create Property Group ──────────────────────────
  console.log("📋 Step 1: Creating custom properties...\n");

  const properties = [
    {
      name: "cabinet_style_preference",
      label: "Cabinet Style",
      type: "enumeration",
      fieldType: "select",
      groupName: "contactinformation",
      options: [
        { label: "Shaker", value: "shaker" },
        { label: "Estate (Recessed Panel)", value: "estate" },
        { label: "Modern Wood", value: "modern_wood" },
        { label: "Undecided", value: "undecided" },
      ],
    },
    {
      name: "ceiling_height_inches",
      label: "Ceiling Height (inches)",
      type: "number",
      fieldType: "number",
      groupName: "contactinformation",
    },
    {
      name: "wall_count",
      label: "Wall Count",
      type: "number",
      fieldType: "number",
      groupName: "contactinformation",
    },
    {
      name: "kitchen_total_linear_feet",
      label: "Total Linear Feet",
      type: "number",
      fieldType: "number",
      groupName: "contactinformation",
    },
    {
      name: "appliance_cutouts",
      label: "Appliance Cutouts",
      type: "string",
      fieldType: "text",
      groupName: "contactinformation",
    },
    {
      name: "cabinet_count_base",
      label: "Base Cabinet Count",
      type: "number",
      fieldType: "number",
      groupName: "contactinformation",
    },
    {
      name: "cabinet_count_upper",
      label: "Upper Cabinet Count",
      type: "number",
      fieldType: "number",
      groupName: "contactinformation",
    },
    {
      name: "preferred_designer",
      label: "Preferred Designer",
      type: "string",
      fieldType: "text",
      groupName: "contactinformation",
    },
    {
      name: "project_type",
      label: "Project Type",
      type: "enumeration",
      fieldType: "select",
      groupName: "contactinformation",
      options: [
        { label: "Kitchen (Full)", value: "kitchen_full" },
        { label: "Kitchen (Partial)", value: "kitchen_partial" },
        { label: "Bathroom", value: "bathroom" },
        { label: "Laundry", value: "laundry" },
        { label: "Garage", value: "garage" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "budget_range",
      label: "Budget Range",
      type: "enumeration",
      fieldType: "select",
      groupName: "contactinformation",
      options: [
        { label: "Under $5K", value: "under_5k" },
        { label: "$5K - $15K", value: "5k_15k" },
        { label: "$15K - $30K", value: "15k_30k" },
        { label: "$30K - $50K", value: "30k_50k" },
        { label: "Over $50K", value: "over_50k" },
      ],
    },
    {
      name: "ai_call_summary",
      label: "AI Call Summary",
      type: "string",
      fieldType: "textarea",
      groupName: "contactinformation",
    },
    {
      name: "ai_call_recording_url",
      label: "AI Call Recording URL",
      type: "string",
      fieldType: "text",
      groupName: "contactinformation",
    },
    {
      name: "ai_call_transcript",
      label: "AI Call Transcript",
      type: "string",
      fieldType: "textarea",
      groupName: "contactinformation",
    },
    {
      name: "recording_consent_given",
      label: "Recording Consent Given",
      type: "bool",
      fieldType: "booleancheckbox",
      groupName: "contactinformation",
    },
    {
      name: "last_ai_call_date",
      label: "Last AI Call Date",
      type: "date",
      fieldType: "date",
      groupName: "contactinformation",
    },
  ];

  for (const prop of properties) {
    try {
      await createCustomProperty("contacts", prop);
      console.log(`  ✓ Created: ${prop.label} (${prop.name})`);
    } catch (err: any) {
      console.error(
        `  ✗ Failed: ${prop.name} — ${err.response?.data?.message || err.message}`
      );
    }
  }

  // ─── Step 2: Create Cabinet Sales Pipeline ──────────────────
  console.log("\n🏗️ Step 2: Creating cabinet sales pipeline...\n");

  try {
    const pipeline = await createPipeline("deals", {
      label: "Cabinet Sales",
      stages: [
        { label: "Voice AI Inquiry", metadata: { probability: "0.05" } },
        { label: "Measurement Scheduled", metadata: { probability: "0.15" } },
        { label: "Measurement Complete", metadata: { probability: "0.30" } },
        { label: "Quote Sent", metadata: { probability: "0.50" } },
        { label: "Quote Approved", metadata: { probability: "0.70" } },
        { label: "Order Placed", metadata: { probability: "0.85" } },
        { label: "Closed Won", metadata: { probability: "1.00" } },
        { label: "Closed Lost", metadata: { probability: "0.00" } },
      ],
    });

    if (pipeline) {
      console.log(`  ✓ Pipeline created: ${pipeline.id}`);
      console.log(`  → Add HUBSPOT_PIPELINE_ID=${pipeline.id} to .env if needed`);
    }
  } catch (err: any) {
    console.error(
      `  ✗ Pipeline failed: ${err.response?.data?.message || err.message}`
    );
  }

  // ─── Summary ───────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  HUBSPOT SETUP COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  Custom Properties: ${properties.length} created`);
  console.log("  Pipeline: Cabinet Sales (8 stages)");
  console.log("\n  Next: Run setup-vapi to create the voice agents.\n");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
