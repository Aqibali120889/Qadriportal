export type Confidence = "high" | "medium" | "low";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ExtractedField {
  id: string;
  label: string;
  value: string;
  originalValue: string;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  isEdited: boolean;
  unit?: string;
  readOnly?: boolean;
}

export interface FieldSection {
  id: string;
  title: string;
  fields: ExtractedField[];
}

export interface ExcelRow {
  id: string;
  line: number;
  description: string;
  drawingRef: string;
  material: string;
  qty: number;
  unit: string;
  weightKg: number;
  ratePerKg: number;
  amount: number;
  isModified: boolean;
  isCalculated: boolean;
}

export const CONFIDENCE_CONFIG: Record<Confidence, { color: string; bg: string; darkBg: string; label: string }> = {
  high:   { color: "#22C55E", bg: "rgba(34,197,94,0.08)",   darkBg: "rgba(34,197,94,0.12)",   label: "High"   },
  medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  darkBg: "rgba(245,158,11,0.12)",  label: "Medium" },
  low:    { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   darkBg: "rgba(239,68,68,0.12)",   label: "Low"    },
};

export const INITIAL_SECTIONS: FieldSection[] = [
  {
    id: "general",
    title: "General Information",
    fields: [
      { id: "dwg_no",    label: "Drawing Number",   value: "DWG-2026-001-A",         originalValue: "DWG-2026-001-A",         confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "comp_name", label: "Component Name",   value: "Crusher Housing Assembly",originalValue: "Crusher Housing Assembly",confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "revision",  label: "Revision",         value: "Rev. 3",                 originalValue: "Rev. 3",                 confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "quantity",  label: "Quantity",         value: "1",                      originalValue: "1",                      confidence: "medium", reviewStatus: "pending", isEdited: false, unit: "Set" },
    ],
  },
  {
    id: "material",
    title: "Material Information",
    fields: [
      { id: "material",  label: "Material",         value: "Cast Iron",              originalValue: "Cast Iron",              confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "grade",     label: "Grade",            value: "ASTM A48 Class 35",      originalValue: "ASTM A48 Class 35",      confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "weight",    label: "Weight",           value: "2450",                   originalValue: "2420",                   confidence: "low",    reviewStatus: "pending", isEdited: true, unit: "kg" },
      { id: "density",   label: "Density",          value: "7.2",                    originalValue: "7.2",                    confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "g/cm³" },
    ],
  },
  {
    id: "dimensions",
    title: "Dimensions",
    fields: [
      { id: "length",    label: "Length",           value: "1850",                   originalValue: "1850",                   confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "width",     label: "Width",            value: "1200",                   originalValue: "1200",                   confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "height",    label: "Height",           value: "980",                    originalValue: "980",                    confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "thickness", label: "Wall Thickness",   value: "45",                     originalValue: "48",                     confidence: "low",    reviewStatus: "pending", isEdited: true,  unit: "mm" },
      { id: "diameter",  label: "Bore Diameter",    value: "320",                    originalValue: "320",                    confidence: "medium", reviewStatus: "pending", isEdited: false, unit: "mm" },
    ],
  },
  {
    id: "manufacturing",
    title: "Manufacturing Information",
    fields: [
      { id: "finish",    label: "Surface Finish",   value: "3.2 Ra",                 originalValue: "3.2 Ra",                 confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "tolerance", label: "Tolerance",        value: "±0.5",                   originalValue: "±0.5",                   confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "heat",      label: "Heat Treatment",   value: "Stress Relieved",        originalValue: "Stress Relieved",        confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "coating",   label: "Coating",          value: "Epoxy Paint",            originalValue: "N/A",                    confidence: "low",    reviewStatus: "pending", isEdited: true  },
      { id: "standard",  label: "Standard",         value: "BS EN 1561",             originalValue: "BS EN 1561",             confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "remarks",   label: "Remarks",          value: "Critical load-bearing; witness inspection required", originalValue: "Critical load-bearing; witness inspection required", confidence: "high", reviewStatus: "pending", isEdited: false },
    ],
  },
];

export const INITIAL_EXCEL_ROWS: ExcelRow[] = [
  { id: "r1",  line: 1, description: "Crusher Housing Body (Upper)",    drawingRef: "DWG-001-A", material: "Cast Iron ASTM A48 Cl35", qty: 1, unit: "EA", weightKg: 1250, ratePerKg: 485, amount: 606250,  isModified: false, isCalculated: false },
  { id: "r2",  line: 2, description: "Crusher Housing Body (Lower)",    drawingRef: "DWG-001-B", material: "Cast Iron ASTM A48 Cl35", qty: 1, unit: "EA", weightKg: 1200, ratePerKg: 485, amount: 582000,  isModified: false, isCalculated: false },
  { id: "r3",  line: 3, description: "Side Liner Plate (Left)",         drawingRef: "DWG-002-A", material: "Mn Steel AS2074 Gr H1A",  qty: 2, unit: "EA", weightKg: 145,  ratePerKg: 720, amount: 208800,  isModified: false, isCalculated: false },
  { id: "r4",  line: 4, description: "Side Liner Plate (Right)",        drawingRef: "DWG-002-B", material: "Mn Steel AS2074 Gr H1A",  qty: 2, unit: "EA", weightKg: 145,  ratePerKg: 720, amount: 208800,  isModified: false, isCalculated: false },
  { id: "r5",  line: 5, description: "Bearing Housing Cover",           drawingRef: "DWG-003",   material: "Mild Steel IS 2062 E250",  qty: 2, unit: "EA", weightKg: 38,   ratePerKg: 320, amount: 24320,   isModified: true,  isCalculated: false },
  { id: "r6",  line: 6, description: "Bolts & Fasteners Set",           drawingRef: "STD-001",   material: "High Tensile Grade 8.8",   qty: 1, unit: "LOT",weightKg: 22,   ratePerKg: 950, amount: 20900,   isModified: false, isCalculated: false },
  { id: "r7",  line: 7, description: "Machining & Finishing (CNC)",     drawingRef: "—",         material: "Labour",                   qty: 1, unit: "LOT",weightKg: 0,    ratePerKg: 0,   amount: 185000,  isModified: false, isCalculated: false },
  { id: "r8",  line: 8, description: "Epoxy Painting (2 Coats)",        drawingRef: "—",         material: "Consumables",              qty: 1, unit: "LOT",weightKg: 0,    ratePerKg: 0,   amount: 28500,   isModified: false, isCalculated: false },
  { id: "r9",  line: 9, description: "NDT Inspection & Testing",        drawingRef: "—",         material: "Service",                  qty: 1, unit: "LOT",weightKg: 0,    ratePerKg: 0,   amount: 45000,   isModified: false, isCalculated: false },
  { id: "r10", line:10, description: "Packing & Forwarding",            drawingRef: "—",         material: "Service",                  qty: 1, unit: "LOT",weightKg: 0,    ratePerKg: 0,   amount: 18000,   isModified: false, isCalculated: false },
];
