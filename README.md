# Kitchen Crest Cabinets — Voice AI Demo

Multi-agent Voice AI system for Kitchen Crest Cabinets using **Vapi Squads**. Features 1 Main Receptionist ("Aria") + 5 personalized Designer Assistants with HubSpot CRM integration, knowledge base RAG, warm transfers, and Florida recording compliance.

## Architecture

```
INBOUND CALL → Aria (Main Receptionist)
                    ├── New Customer → Qualify → Push to HubSpot
                    ├── Existing Customer → Route by need
                    ├── Product FAQ → Knowledge Base (RAG)
                    ├── "Talk to Jen" → Squad Handoff → Jen's Assistant
                    │                                   ├── Collect Measurements
                    │                                   ├── Push to HubSpot
                    │                                   └── Warm Transfer to Jen's Cell
                    ├── "Talk to Carlos" → Carlos's Assistant
                    ├── "Talk to Nancy" → Nancy's Assistant
                    ├── "Talk to Maria" → Maria's Assistant
                    └── "Talk to Derek" → Derek's Assistant
```

## Quick Start (Demo Setup)

### Prerequisites
- Node.js 18+
- [Vapi account](https://vapi.ai) (comes with $10 free credit)
- [HubSpot account](https://app.hubspot.com) with a Private App
- [ngrok](https://ngrok.com) for local tunnel

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_ORG/kcc-voice-agents.git
cd kcc-voice-agents
npm install
cp .env.example .env
```

### 2. Configure .env

```env
VAPI_API_KEY=your_vapi_api_key
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token
SERVER_URL=https://your-ngrok-url.ngrok-free.app
PORT=3000
```

**Get your keys:**
- **Vapi**: Dashboard → Settings → API Keys
- **HubSpot**: Settings → Integrations → Private Apps → Create → grant `crm.objects.contacts.write`, `crm.objects.deals.write`, `crm.objects.contacts.read`, `crm.schemas.contacts.write`

### 3. Start Server + Tunnel

```bash
# Terminal 1: Start webhook server
npm run dev

# Terminal 2: Expose via ngrok
ngrok http 3000
```

Copy the ngrok HTTPS URL into your `.env` as `SERVER_URL`, then restart the dev server.

### 4. Setup HubSpot Properties

```bash
npx tsx scripts/setup-hubspot.ts
```

Creates 15 custom contact properties + Cabinet Sales pipeline (8 stages).

### 5. Provision Vapi Agents

```bash
npx tsx scripts/setup-vapi.ts
```

This script:
1. Uploads all 8 knowledge base files to Vapi
2. Creates Aria (Main Receptionist) with knowledge base + tools
3. Creates Aria (After Hours) for message-taking
4. Creates 5 Designer Assistants (Jen, Carlos, Nancy, Maria, Derek)
5. Creates the Squad linking all 6 agents
6. Configures your phone number (if VAPI_PHONE_NUMBER_ID is set)

Add the output IDs to your `.env`:
```env
VAPI_ARIA_ASSISTANT_ID=...
VAPI_ARIA_AFTER_HOURS_ID=...
VAPI_SQUAD_ID=...
```

### 6. Buy a Phone Number

In Vapi Dashboard → Phone Numbers → Create New:
- Select Orlando 407 area code
- Assign the Squad created in step 5
- Set Server URL to `{your-ngrok-url}/vapi/webhook`

### 7. Test!

Call the number and try:
- **New customer**: "Hi, I'm a contractor looking for Shaker White cabinets"
- **Product FAQ**: "What's your lead time for RTA cabinets?"
- **Designer handoff**: "I need to talk to Jen about my project"
- **After hours**: Call outside Mon-Fri 8AM-5PM EST

---

## Demo Scenarios (for tomorrow's meeting)

### Scenario 1: New Contractor (3 min)
> "Hi, I'm Mike Thompson, a contractor in Orlando. I need about 15 cabinets in Shaker White. What's your lead time?"

**Shows**: Recording consent, lead qualification, RAG product knowledge, CRM push

### Scenario 2: Existing Customer (2 min)
> "Hi, this is Mike Thompson. I placed an order last week, when will it be delivered?"

**Shows**: Customer recognition, contextual greeting

### Scenario 3: Designer Handoff + Measurements (4 min)
> "I need to talk to Jen about my project."
> Then: "Kitchen. Three walls — 12, 8, and 10 feet. Standard 8-foot ceilings. Shaker White."

**Shows**: Squad handoff, measurement collection, HubSpot population, warm transfer offer

### Scenario 4: HubSpot Live View (2 min)
Split screen: phone call on left, HubSpot on right. Show CRM updating in real-time as AI collects data.

---

## Project Structure

```
kcc-voice-agents/
├── src/
│   ├── server.ts                 # Express server entry point
│   ├── config/
│   │   ├── constants.ts          # Business hours, locations, cabinet lines
│   │   └── designers.ts          # Designer roster (5 designers)
│   ├── webhooks/
│   │   ├── index.ts              # Webhook router
│   │   ├── tool-calls.ts         # push_to_hubspot, collect_measurements, etc.
│   │   ├── end-of-call.ts        # Post-call → HubSpot (transcript, recording, task)
│   │   └── assistant-request.ts  # After-hours routing
│   ├── services/
│   │   ├── hubspot.ts            # HubSpot API client
│   │   └── business-hours.ts     # Timezone-aware hours check
│   └── vapi/
│       ├── assistants.ts         # Assistant config builders
│       ├── squad.ts              # Squad config builder
│       ├── tools.ts              # Tool definitions
│       └── prompts/
│           ├── aria.ts           # Main receptionist + after-hours prompts
│           └── designer.ts       # Designer assistant prompt template
├── knowledge-base/
│   ├── kc-product-catalog.md     # All 7 cabinet lines overview
│   ├── kc-shaker-white-skus.md   # Complete SW SKU reference
│   ├── kc-estate-lines-skus.md   # Estate Black/White/Sage SKUs
│   ├── kc-faq.md                 # Top 15+ FAQs
│   ├── kc-locations-hours.md     # All 5 warehouse locations
│   ├── kc-policies.md            # Returns, shipping, payment
│   ├── kc-materials-construction.md  # Materials & build quality
│   └── kc-accessories-trim.md    # Crown molding, fillers, panels
└── scripts/
    ├── setup-vapi.ts             # Provision all Vapi resources
    └── setup-hubspot.ts          # Create HubSpot properties + pipeline
```

## Webhook Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /vapi/webhook` | Main Vapi webhook (routes by message type) |
| `POST /vapi/tool-calls` | Direct tool execution endpoint |
| `GET /health` | Health check |

## Tools Available to Agents

| Tool | Used By | Purpose |
|------|---------|---------|
| `push_to_hubspot` | Aria + Designers | Push lead/measurement data to CRM |
| `collect_measurements` | Designers | Structured room measurement collection |
| `check_business_hours` | Aria | Determine if office is open |
| `save_message` | Aria (after-hours) | Save callback message to HubSpot |
| `search_kitchen_crest_kb` | All agents | RAG query against knowledge base |
| `handoff_to_designer` | Aria | Squad handoff to designer assistant |
| `warmTransferTo{Name}` | Designers | Warm transfer to designer's cell phone |

## HubSpot Custom Properties

15 custom contact properties created under "Cabinet Measurement Data":
- `cabinet_style_preference`, `ceiling_height_inches`, `wall_count`
- `kitchen_total_linear_feet`, `appliance_cutouts`
- `cabinet_count_base`, `cabinet_count_upper`
- `preferred_designer`, `project_type`, `budget_range`
- `ai_call_summary`, `ai_call_recording_url`, `ai_call_transcript`
- `recording_consent_given`, `last_ai_call_date`

## Pipeline: Cabinet Sales (8 stages)

Voice AI Inquiry → Measurement Scheduled → Measurement Complete → Quote Sent → Quote Approved → Order Placed → Closed Won / Closed Lost
