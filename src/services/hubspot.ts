import axios, { AxiosInstance } from "axios";

const HS: AxiosInstance = axios.create({
  baseURL: "https://api.hubapi.com",
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// ─── Contact Operations ─────────────────────────────────────

export async function searchContactByPhone(phone: string) {
  const { data } = await HS.post("/crm/v3/objects/contacts/search", {
    filterGroups: [
      {
        filters: [
          { propertyName: "phone", operator: "EQ", value: phone },
        ],
      },
    ],
    properties: [
      "firstname",
      "lastname",
      "email",
      "phone",
      "company",
      "preferred_designer",
      "lifecyclestage",
    ],
  });
  return data.results.length > 0 ? data.results[0] : null;
}

export async function createContact(properties: Record<string, string>) {
  const { data } = await HS.post("/crm/v3/objects/contacts", {
    properties: {
      lifecyclestage: "lead",
      hs_lead_status: "NEW",
      ...properties,
    },
  });
  return data;
}

export async function updateContact(
  contactId: string,
  properties: Record<string, string | number>
) {
  const { data } = await HS.patch(
    `/crm/v3/objects/contacts/${contactId}`,
    { properties }
  );
  return data;
}

export async function findOrCreateContact(
  phone: string,
  properties: Record<string, string> = {}
) {
  const existing = await searchContactByPhone(phone);
  if (existing) {
    if (Object.keys(properties).length > 0) {
      await updateContact(existing.id, properties);
    }
    return { contact: existing, isNew: false };
  }
  const created = await createContact({ phone, ...properties });
  return { contact: created, isNew: true };
}

// ─── Call Engagement ─────────────────────────────────────────

export async function logCallEngagement(params: {
  contactId: string;
  startedAt: string;
  transcript: string;
  durationMs: number;
  recordingUrl: string;
  summary: string;
}) {
  const { data } = await HS.post("/crm/v3/objects/calls", {
    properties: {
      hs_timestamp: params.startedAt,
      hs_call_title: "Voxaris AI - Cabinet Inquiry",
      hs_call_body: params.summary || params.transcript.slice(0, 500),
      hs_call_duration: params.durationMs.toString(),
      hs_call_recording_url: params.recordingUrl,
      hs_call_status: "COMPLETED",
      hs_call_direction: "INBOUND",
    },
    associations: [
      {
        to: { id: params.contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 194, // call → contact
          },
        ],
      },
    ],
  });
  return data;
}

// ─── Notes ───────────────────────────────────────────────────

export async function createNote(contactId: string, body: string) {
  const { data } = await HS.post("/crm/v3/objects/notes", {
    properties: { hs_note_body: body },
    associations: [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 190, // note → contact
          },
        ],
      },
    ],
  });
  return data;
}

// ─── Tasks ───────────────────────────────────────────────────

export async function createFollowUpTask(params: {
  contactId: string;
  subject: string;
  body: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
}) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const { data } = await HS.post("/crm/v3/objects/tasks", {
    properties: {
      hs_timestamp: tomorrow,
      hs_task_subject: params.subject,
      hs_task_body: params.body,
      hs_task_status: "NOT_STARTED",
      hs_task_priority: params.priority || "HIGH",
    },
    associations: [
      {
        to: { id: params.contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 204, // task → contact
          },
        ],
      },
    ],
  });
  return data;
}

// ─── Deals ───────────────────────────────────────────────────

export async function createDeal(params: {
  contactId: string;
  dealName: string;
  pipelineId?: string;
  stage?: string;
  amount?: number;
}) {
  const { data } = await HS.post("/crm/v3/objects/deals", {
    properties: {
      dealname: params.dealName,
      pipeline: params.pipelineId || "cabinet_sales",
      dealstage: params.stage || "voice_ai_inquiry",
      ...(params.amount ? { amount: params.amount.toString() } : {}),
    },
    associations: [
      {
        to: { id: params.contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 3, // deal → contact
          },
        ],
      },
    ],
  });
  return data;
}

// ─── Custom Properties (for setup script) ────────────────────

export async function createCustomProperty(
  objectType: string,
  property: {
    name: string;
    label: string;
    type: string;
    fieldType: string;
    groupName: string;
    options?: Array<{ label: string; value: string }>;
  }
) {
  try {
    const { data } = await HS.post(
      `/crm/v3/properties/${objectType}`,
      property
    );
    return data;
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log(`  Property "${property.name}" already exists — skipping`);
      return null;
    }
    throw err;
  }
}

export async function createPipeline(
  objectType: string,
  pipeline: {
    label: string;
    stages: Array<{
      label: string;
      metadata: { probability: string };
    }>;
  }
) {
  try {
    const { data } = await HS.post(
      `/crm/v3/pipelines/${objectType}`,
      pipeline
    );
    return data;
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log(`  Pipeline "${pipeline.label}" already exists — skipping`);
      return null;
    }
    throw err;
  }
}
