export const BUSINESS_HOURS = {
  timezone: "America/New_York",
  schedule: {
    // Orlando office hours
    monday: { open: "08:00", close: "17:00" },
    tuesday: { open: "08:00", close: "17:00" },
    wednesday: { open: "08:00", close: "17:00" },
    thursday: { open: "08:00", close: "17:00" },
    friday: { open: "08:00", close: "17:00" },
    saturday: null, // closed
    sunday: null, // closed
  },
} as const;

export const LOCATIONS = {
  orlando: {
    name: "Orlando, FL",
    address: "5257 LB McLeod Rd Suite 100B, Orlando, FL 32811",
    phone: "(407) 479-7560",
    email: "orders.orl@mykitchencrest.com",
    size: "~40,000 sq ft",
    hours: "Mon-Fri 8 AM - 5 PM EST",
  },
  melrose_park: {
    name: "Melrose Park, IL (HQ)",
    address: "1950 George St, Melrose Park, IL",
    phone: "(630) 868-0888",
    email: "orders@mykitchencrest.com",
    size: "100,000+ sq ft",
    hours: "Mon-Fri 8 AM - 5 PM CST",
  },
  san_antonio: {
    name: "San Antonio, TX",
    address: "1877 Hormel Dr, San Antonio, TX",
    phone: "(210) 774-5446",
    email: "orders.sa@mykitchencrest.com",
    size: "~30,000 sq ft",
    hours: "Mon-Fri 8 AM - 5 PM CST",
  },
  miami: {
    name: "Miami, FL",
    address: "2958 NW 72nd Ave, Miami, FL 33122",
    phone: "(305) 994-7226",
    email: "orders.mia@mykitchencrest.com",
    size: "N/A",
    hours: "Mon-Fri 9 AM - 5 PM EST, Sat by appointment",
  },
  madison: {
    name: "Madison, WI",
    address: "121 Nob Hill Rd, Madison, WI",
    phone: "(630) 868-0888",
    email: "orders.mad@mykitchencrest.com",
    size: "N/A",
    hours: "Mon-Fri 8 AM - 5 PM CST",
  },
} as const;

export const CABINET_LINES = [
  { name: "Shaker White", prefix: "SW", style: "Shaker (5-piece)", color: "White" },
  { name: "Light Gray", prefix: "LG", style: "Shaker (5-piece)", color: "Light Gray" },
  { name: "Shaker Navy", prefix: "SN", style: "Shaker (5-piece)", color: "Navy Blue" },
  { name: "Modern Wood", prefix: "MW", style: "Shaker (wood grain)", color: "Natural Wood" },
  { name: "Estate Black", prefix: "EB", style: "Recessed Panel", color: "Black" },
  { name: "Estate White", prefix: "EW", style: "Recessed Panel", color: "White" },
  { name: "Estate Sage", prefix: "ES", style: "Recessed Panel", color: "Sage Green" },
] as const;

export const HUBSPOT_PIPELINE_ID = "cabinet_sales";

export const HUBSPOT_PIPELINE_STAGES = [
  { id: "voice_ai_inquiry", label: "Voice AI Inquiry", probability: 0.05 },
  { id: "measurement_scheduled", label: "Measurement Scheduled", probability: 0.15 },
  { id: "measurement_complete", label: "Measurement Complete", probability: 0.3 },
  { id: "quote_sent", label: "Quote Sent", probability: 0.5 },
  { id: "quote_approved", label: "Quote Approved", probability: 0.7 },
  { id: "order_placed", label: "Order Placed", probability: 0.85 },
  { id: "closedwon", label: "Closed Won", probability: 1.0 },
  { id: "closedlost", label: "Closed Lost", probability: 0.0 },
] as const;
