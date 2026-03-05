export interface Designer {
  name: string;
  assistantName: string;
  phone: string;
  envKey: string;
  specialty: string;
  notes: string;
}

export const DESIGNERS: Designer[] = [
  {
    name: "Jen",
    assistantName: "Jen's Personal Assistant",
    phone: process.env.DESIGNER_JEN_PHONE || "+14075551001",
    envKey: "DESIGNER_JEN_PHONE",
    specialty: "Residential kitchens, Shaker White specialist",
    notes: "Prefers imperial measurements. Focuses on Orlando residential market.",
  },
  {
    name: "Carlos",
    assistantName: "Carlos's Personal Assistant",
    phone: process.env.DESIGNER_CARLOS_PHONE || "+14075551002",
    envKey: "DESIGNER_CARLOS_PHONE",
    specialty: "Commercial projects, multi-family developments",
    notes: "Comfortable with metric for commercial projects. Bilingual English/Spanish.",
  },
  {
    name: "Nancy",
    assistantName: "Nancy's Personal Assistant",
    phone: process.env.DESIGNER_NANCY_PHONE || "+14075551003",
    envKey: "DESIGNER_NANCY_PHONE",
    specialty: "Orlando residential market, Estate lines",
    notes: "Expert in Estate line styling. Focuses on high-end residential projects.",
  },
  {
    name: "Maria",
    assistantName: "Maria's Personal Assistant",
    phone: process.env.DESIGNER_MARIA_PHONE || "+14075551004",
    envKey: "DESIGNER_MARIA_PHONE",
    specialty: "Builder partnerships, volume orders",
    notes: "Handles bulk builder accounts. Bilingual English/Spanish.",
  },
  {
    name: "Derek",
    assistantName: "Derek's Personal Assistant",
    phone: process.env.DESIGNER_DEREK_PHONE || "+14075551005",
    envKey: "DESIGNER_DEREK_PHONE",
    specialty: "Contractor accounts, quick-turn projects",
    notes: "Fastest response time. Specializes in rapid turnaround projects.",
  },
];

export function getDesignerByName(name: string): Designer | undefined {
  return DESIGNERS.find(
    (d) => d.name.toLowerCase() === name.toLowerCase()
  );
}
