export type MessageRole = "user" | "assistant";
export type Confidence  = "high" | "medium" | "low";

export interface MessageSource {
  id: string;
  name: string;
  type: "drawing" | "excel" | "pdf" | "sop" | "project" | "standard";
  page?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  sources?: MessageSource[];
  confidence?: Confidence;
  liked?: boolean | null;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  rfqId?: string;
  preview: string;
  lastUpdated: string;
  pinned: boolean;
  archived: boolean;
  messages: Message[];
}

export interface ContextChip {
  id: string;
  label: string;
  type: "rfq" | "drawing" | "excel" | "project" | "general";
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "drawing" | "excel" | "pdf" | "sop" | "project" | "standard" | "catalog";
  updated: string;
  size?: string;
}

export const SUGGESTED_ACTIONS = [
  { id: "analyze",   label: "Analyze Drawing",           icon: "🔍" },
  { id: "explain",   label: "Explain Drawing",            icon: "📐" },
  { id: "summarize", label: "Summarize RFQ",              icon: "📋" },
  { id: "similar",   label: "Find Similar Projects",      icon: "🔗" },
  { id: "compare",   label: "Compare Previous Estimates", icon: "📊" },
  { id: "cost",      label: "Generate Cost Summary",      icon: "💰" },
  { id: "vendor",    label: "Draft Vendor Email",         icon: "✉️" },
  { id: "terms",     label: "Explain Engineering Terms",  icon: "📚" },
  { id: "knowledge", label: "Search Company Knowledge",   icon: "🗂️" },
  { id: "summary",   label: "Generate Project Summary",   icon: "📝" },
];

export const KNOWLEDGE_CATEGORIES: { id: string; label: string; count: number; updated: string }[] = [
  { id: "drawings",   label: "Engineering Drawings",  count: 247, updated: "Today"        },
  { id: "rfqs",       label: "RFQs",                 count: 183, updated: "2h ago"        },
  { id: "excel",      label: "Excel Sheets",          count: 312, updated: "Today"        },
  { id: "projects",   label: "Previous Projects",     count: 98,  updated: "Yesterday"    },
  { id: "sops",       label: "SOP Documents",         count: 34,  updated: "3 days ago"   },
  { id: "materials",  label: "Material Catalog",      count: 1420,updated: "1 week ago"   },
  { id: "machines",   label: "Machine Specifications",count: 89,  updated: "2 weeks ago"  },
  { id: "internal",   label: "Internal Documentation",count: 156, updated: "Yesterday"    },
];

const SOURCES_CRUSHER: MessageSource[] = [
  { id: "s1", name: "DWG-2026-001-A.pdf",       type: "drawing", page: "Sheet 1" },
  { id: "s2", name: "Crusher_Housing_Spec.pdf", type: "pdf",     page: "Section 3.2" },
  { id: "s3", name: "ASTM A48 Standard",        type: "standard" },
];

const SOURCES_COST: MessageSource[] = [
  { id: "s4", name: "RFQ-2026-001.xlsx",         type: "excel" },
  { id: "s5", name: "Cast Iron Price List Q3",   type: "catalog" },
  { id: "s6", name: "RFQ-2025-087 Lucky Cement", type: "project" },
];

const MSG_1: Message = {
  id: "m1", role: "user",
  content: "Analyze the Crusher Housing drawing for RFQ-2026-001. What are the critical manufacturing specifications?",
  timestamp: "09:41 AM",
};

const MSG_2: Message = {
  id: "m2", role: "assistant",
  content: `## Crusher Housing Assembly — RFQ-2026-001

Based on drawing **DWG-2026-001-A (Rev. 3)**, here are the critical manufacturing specifications:

### Key Dimensions
| Parameter | Value | Tolerance |
|---|---|---|
| Overall Length | 1,850 mm | ±2.0 mm |
| Width | 1,200 mm | ±2.0 mm |
| Height | 980 mm | ±2.0 mm |
| Wall Thickness | 45 mm | ±0.5 mm |
| Bore Diameter | ∅320 mm | H7 |
| Bolt Circle PCD | ∅90 mm | ±0.1 mm |

### Material Requirements
- **Material:** Cast Iron ASTM A48 Class 35
- **Min. Tensile Strength:** 241 MPa
- **Hardness:** 187–241 HB (Brinell)
- **Heat Treatment:** Stress relieved at 550°C ±15°C

### Critical Notes
1. **Bore tolerance:** H7 fit is critical — requires precision CNC boring
2. **Surface finish:** 3.2 Ra on all mating/machined surfaces
3. **NDT:** Magnetic particle inspection required on bore and flange areas
4. **Witness point:** Customer inspection before despatch

> ⚠️ The wall thickness dimension (45 mm) was flagged at **low confidence** in AI extraction — manual verification against the drawing is recommended before quoting.`,
  timestamp: "09:42 AM",
  sources: SOURCES_CRUSHER,
  confidence: "high",
  liked: true,
};

const MSG_3: Message = {
  id: "m3", role: "user",
  content: "Generate a cost summary for this RFQ based on current material rates and compare with RFQ-2025-087.",
  timestamp: "09:45 AM",
};

const MSG_4: Message = {
  id: "m4", role: "assistant",
  content: `## Cost Estimation Summary — RFQ-2026-001

### Current Estimate vs. Historical Reference

| Line Item | RFQ-2026-001 (Current) | RFQ-2025-087 (Ref.) | Δ Change |
|---|---|---|---|
| Cast Iron Body | PKR 1,188,250 | PKR 1,045,000 | +13.7% |
| Liner Plates (Mn Steel) | PKR 417,600 | PKR 380,000 | +9.9% |
| Machining & CNC | PKR 185,000 | PKR 165,000 | +12.1% |
| Epoxy Painting | PKR 28,500 | PKR 25,000 | +14.0% |
| NDT & Inspection | PKR 45,000 | PKR 38,000 | +18.4% |
| Misc. (Fasteners, Packing) | PKR 38,900 | PKR 34,500 | +12.8% |
| **Total** | **PKR 1,903,250** | **PKR 1,687,500** | **+12.8%** |

### Key Observations
- Material cost increase is primarily driven by **Cast Iron ASTM A48 price revision (+14%)** since Q4 2025
- NDT inspection cost has increased due to **mandatory witness inspection clause** added by Lucky Cement
- Overall estimate is **within acceptable range** — comparable projects ranged PKR 1.6M–2.1M

### Recommendation
\`\`\`
Suggested Selling Price: PKR 2,285,000 (with 20% margin)
Min. Acceptable Price:   PKR 1,980,000 (with 4% margin)
\`\`\`

*Referenced from Cast Iron Price List Q3 2026 and historical project RFQ-2025-087.*`,
  timestamp: "09:46 AM",
  sources: SOURCES_COST,
  confidence: "medium",
  liked: null,
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    title: "Crusher Housing — RFQ-2026-001",
    rfqId: "RFQ-2026-001",
    preview: "Critical manufacturing specifications and cost comparison...",
    lastUpdated: "09:46 AM",
    pinned: true,
    archived: false,
    messages: [MSG_1, MSG_2, MSG_3, MSG_4],
  },
  {
    id: "c2",
    title: "Kiln Drive Gearbox Analysis",
    rfqId: "RFQ-2026-002",
    preview: "Material grade selection for DG Cement gearbox...",
    lastUpdated: "Yesterday",
    pinned: true,
    archived: false,
    messages: [],
  },
  {
    id: "c3",
    title: "Ball Mill Liner Set — Maple Leaf",
    rfqId: "RFQ-2026-003",
    preview: "Mn Steel alternatives and machining recommendations...",
    lastUpdated: "Yesterday",
    pinned: false,
    archived: false,
    messages: [],
  },
  {
    id: "c4",
    title: "Cast Iron Pricing Q3 2026",
    preview: "Market analysis for foundry materials...",
    lastUpdated: "2 days ago",
    pinned: false,
    archived: false,
    messages: [],
  },
  {
    id: "c5",
    title: "Preheater Tower Casing Review",
    rfqId: "RFQ-2026-004",
    preview: "Structural load analysis for Pioneer Cement...",
    lastUpdated: "3 days ago",
    pinned: false,
    archived: false,
    messages: [],
  },
  {
    id: "c6",
    title: "Vendor Email — Clinker Cooler",
    rfqId: "RFQ-2026-006",
    preview: "Drafted vendor inquiry for Cherat Cement project...",
    lastUpdated: "4 days ago",
    pinned: false,
    archived: false,
    messages: [],
  },
];

export const INITIAL_CONTEXT: ContextChip[] = [
  { id: "ctx1", label: "RFQ-2026-001",      type: "rfq"     },
  { id: "ctx2", label: "Crusher Housing",   type: "project" },
  { id: "ctx3", label: "Cost Estimation",   type: "general" },
  { id: "ctx4", label: "DWG-2026-001-A.pdf",type: "drawing" },
  { id: "ctx5", label: "Cost Sheet.xlsx",   type: "excel"   },
];

export const AI_RESPONSES: Record<string, string> = {
  default: `I'm your AI Engineering Assistant for the **Qadri Group Estimation Portal**. I have access to your drawings, RFQs, material databases, and previous projects.

How can I help you today? You can ask me to:
- Analyze or explain engineering drawings
- Generate or review cost estimations
- Find similar past projects for reference
- Draft vendor or customer communications
- Look up material specifications and standards`,

  analyze: `## Drawing Analysis — DWG-2026-001-A

I've analyzed the uploaded drawing. Here's a structured summary:

### Component Overview
- **Type:** Fabricated + Machined Housing
- **Complexity:** High (CNC boring, precision fits)
- **Estimated Lead Time:** 6–8 weeks

### Manufacturing Operations Required
1. **Pattern Making** — Cast iron mold for upper and lower body
2. **Casting** — ASTM A48 Class 35 pour
3. **Stress Relief** — 550°C heat treatment
4. **CNC Boring** — ∅320 H7 precision bore
5. **Surface Milling** — Flange faces to 3.2 Ra
6. **NDT** — MP inspection (mandatory)
7. **Assembly** — Liner plates, fasteners

### Risk Flags
> ⚠️ Wall thickness at 45mm needs physical measurement verification — AI confidence is **Low**
> ⚠️ Coating specification appears amended — confirm "Epoxy Paint" vs. original "N/A"`,

  cost: `## Cost Summary — Quick Estimate

Based on current rates and similar historical projects:

| Category | Estimated Cost |
|---|---|
| Raw Material (Cast Iron) | PKR 1,188,250 |
| Liner Plates | PKR 417,600 |
| Machining | PKR 185,000 |
| Surface Treatment | PKR 28,500 |
| QC & NDT | PKR 45,000 |
| Overheads | PKR 38,900 |
| **Subtotal** | **PKR 1,903,250** |
| Margin (20%) | PKR 380,650 |
| **Suggested Price** | **PKR 2,283,900** |

*Source: Material rates as of Q3 2026. Comparable: RFQ-2025-087.*`,

  vendor: `## Draft Vendor Email

**Subject:** Enquiry — Cast Iron ASTM A48 Class 35 Supply — RFQ-2026-001

Dear Vendor,

We are inviting quotations for the supply of **Cast Iron ASTM A48 Class 35** castings as per the following specification:

**Required Material:**
- Grade: ASTM A48 Class 35
- Form: Machined Casting
- Approx. Weight: 2,450 kg / set
- Quantity: 1 Set (initial order)

**Delivery Requirements:**
- Required at works: Within 5 weeks from PO
- Packing: Suitable for road transport

Please quote your best rates including GST and confirm material test certificate availability.

*This email was drafted by the AI Assistant. Review before sending.*`,
};
