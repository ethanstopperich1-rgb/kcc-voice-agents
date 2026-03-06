// Tool definitions for Vapi assistant configuration

export function buildToolDefinitions(serverUrl: string) {
  return {
    pushToHubspot: {
      type: "function" as const,
      function: {
        name: "push_to_hubspot",
        description:
          "Push lead data and measurement data to HubSpot CRM. Call this after collecting customer information or measurements.",
        parameters: {
          type: "object",
          properties: {
            contact_name: {
              type: "string",
              description: "Full name of the caller",
            },
            phone: {
              type: "string",
              description: "Phone number of the caller",
            },
            email: {
              type: "string",
              description: "Email address of the caller",
            },
            company: {
              type: "string",
              description: "Company name of the caller",
            },
            project_type: {
              type: "string",
              enum: ["kitchen_full", "kitchen_partial", "bathroom", "laundry", "garage", "other"],
              description: "Type of project",
            },
            ceiling_height: {
              type: "number",
              description: "Ceiling height in inches",
            },
            wall_count: {
              type: "number",
              description: "Number of walls with cabinets",
            },
            linear_feet: {
              type: "number",
              description: "Total linear feet of cabinetry",
            },
            style_preference: {
              type: "string",
              enum: ["shaker", "estate", "modern_wood"],
              description: "Cabinet style preference",
            },
            color_preference: {
              type: "string",
              description: "Color preference (White, Navy, Light Gray, Black, Sage, Natural Wood)",
            },
            appliance_cutouts: {
              type: "string",
              description:
                "Comma-separated list of appliance cutouts needed (fridge, dishwasher, oven, microwave, range_hood)",
            },
            cabinet_count_base: {
              type: "number",
              description: "Number of base cabinets",
            },
            cabinet_count_upper: {
              type: "number",
              description: "Number of upper/wall cabinets",
            },
            budget_range: {
              type: "string",
              enum: ["under_5k", "5k_15k", "15k_30k", "30k_50k", "over_50k"],
              description: "Budget range for the project",
            },
            preferred_designer: {
              type: "string",
              description: "Name of preferred designer (Jen, Carlos, Nancy, Derek)",
            },
          },
          required: ["contact_name"],
        },
      },
      server: { url: `${serverUrl}/vapi/tool-calls` },
      messages: [
        { type: "request-start", content: "Let me save that information..." },
        { type: "request-complete", content: "Got it, all saved!" },
        { type: "request-failed", content: "I had a little trouble saving that. Could you repeat?" },
      ],
    },

    collectMeasurements: {
      type: "function" as const,
      function: {
        name: "collect_measurements",
        description: "Collect and store room measurements from caller",
        parameters: {
          type: "object",
          properties: {
            room_name: { type: "string", description: "Room type: kitchen, bathroom, laundry, etc." },
            length_ft: { type: "number", description: "Room length in feet" },
            width_ft: { type: "number", description: "Room width in feet" },
            ceiling_height_ft: { type: "number", description: "Ceiling height in feet" },
            cabinet_style: { type: "string", description: "Shaker, Estate, or Modern Wood" },
            cabinet_color: { type: "string", description: "Color preference" },
            appliance_cutouts: {
              type: "array",
              items: { type: "string" },
              description: "List of appliances needing cutouts",
            },
          },
          required: ["room_name", "length_ft", "width_ft"],
        },
      },
      server: { url: `${serverUrl}/vapi/tool-calls` },
      messages: [
        { type: "request-start", content: "Let me save those measurements..." },
        { type: "request-complete", content: "Got it, all saved!" },
        { type: "request-failed", content: "Could you repeat those measurements?" },
      ],
    },

    checkBusinessHours: {
      type: "function" as const,
      function: {
        name: "check_business_hours",
        description:
          "Check if Kitchen Crest Orlando office is currently open. Call this to determine if designers are available.",
        parameters: { type: "object", properties: {} },
      },
      server: { url: `${serverUrl}/vapi/tool-calls` },
    },

    saveMessage: {
      type: "function" as const,
      function: {
        name: "save_message",
        description:
          "Save an after-hours message from a caller so the team can call them back.",
        parameters: {
          type: "object",
          properties: {
            caller_name: { type: "string", description: "Name of the caller" },
            callback_number: { type: "string", description: "Phone number to call back" },
            message: { type: "string", description: "Brief description of what they need" },
          },
          required: ["caller_name", "callback_number", "message"],
        },
      },
      server: { url: `${serverUrl}/vapi/tool-calls` },
      messages: [
        { type: "request-start", content: "Saving your message..." },
        {
          type: "request-complete",
          content: "I've saved your message. Our team will reach out first thing tomorrow morning.",
        },
        { type: "request-failed", content: "Let me try again to save that." },
      ],
    },
  };
}
