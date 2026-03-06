export interface Designer {
  name: string;
  phone: string;
  email: string;
  envKey: string;
  specialty: string;
  notes: string;
}

export const DESIGNERS: Designer[] = [
  {
    name: "Jen",
    phone: process.env.DESIGNER_JEN_PHONE || "+14075551001",
    email: process.env.DESIGNER_JEN_EMAIL || "",
    envKey: "DESIGNER_JEN_PHONE",
    specialty: "Residential kitchens, Shaker White specialist",
    notes: "Prefers imperial measurements. Focuses on Orlando residential market.",
  },
  {
    name: "Carlos",
    phone: process.env.DESIGNER_CARLOS_PHONE || "+14075551002",
    email: process.env.DESIGNER_CARLOS_EMAIL || "",
    envKey: "DESIGNER_CARLOS_PHONE",
    specialty: "Commercial projects, multi-family developments",
    notes: "Comfortable with metric for commercial projects. Bilingual English/Spanish.",
  },
  {
    name: "Nancy",
    phone: process.env.DESIGNER_NANCY_PHONE || "+14075551003",
    email: process.env.DESIGNER_NANCY_EMAIL || "",
    envKey: "DESIGNER_NANCY_PHONE",
    specialty: "Orlando residential market, Estate lines",
    notes: "Expert in Estate line styling. Focuses on high-end residential projects.",
  },
  {
    name: "Derek",
    phone: process.env.DESIGNER_DEREK_PHONE || "+14075551005",
    email: process.env.DESIGNER_DEREK_EMAIL || "",
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

/** Get a formatted list of designer names for prompts */
export function getDesignerNames(): string {
  return DESIGNERS.map((d) => d.name).join(", ");
}
