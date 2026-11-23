import type { FieldSection, ExcelRow } from "@/app/types/workspace";

export const FOUNDRY_SECTIONS: FieldSection[] = [
  {
    id: "general",
    title: "General Information",
    fields: [
      { id: "dwg_no",    label: "Drawing Number",   value: "DWG-2026-006-B",               originalValue: "DWG-2026-006-B",               confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "comp_name", label: "Component Name",   value: "Clinker Cooler Frame Assembly", originalValue: "Clinker Cooler Frame Assembly", confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "revision",  label: "Revision",         value: "Rev. 2",                        originalValue: "Rev. 2",                        confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "quantity",  label: "Quantity",         value: "1",                             originalValue: "1",                             confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "Set" },
      { id: "pattern_no",label: "Pattern No.",      value: "PAT-2026-044",                 originalValue: "PAT-2026-044",                 confidence: "medium", reviewStatus: "pending", isEdited: false },
    ],
  },
  {
    id: "casting",
    title: "Casting Specification",
    fields: [
      { id: "alloy",     label: "Alloy / Material", value: "Grey Cast Iron",               originalValue: "Grey Cast Iron",               confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "grade",     label: "Material Grade",   value: "IS 210 Grade FG 260",          originalValue: "IS 210 Grade FG 260",          confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "process",   label: "Casting Process",  value: "Sand Casting (Green Sand)",    originalValue: "Sand Casting (Green Sand)",    confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "weight_net",label: "Net Weight",        value: "3840",                         originalValue: "3840",                         confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "kg" },
      { id: "weight_gross",label:"Gross (Rough) Wt",value: "4420",                         originalValue: "4650",                         confidence: "low",    reviewStatus: "pending", isEdited: true,  unit: "kg" },
      { id: "yield",     label: "Expected Yield",   value: "82",                           originalValue: "85",                           confidence: "low",    reviewStatus: "pending", isEdited: true,  unit: "%" },
    ],
  },
  {
    id: "dimensions",
    title: "Foundry Dimensions",
    fields: [
      { id: "length",    label: "Overall Length",   value: "2240",                         originalValue: "2240",                         confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "width",     label: "Overall Width",    value: "1480",                         originalValue: "1480",                         confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "height",    label: "Overall Height",   value: "620",                          originalValue: "620",                          confidence: "high",   reviewStatus: "pending", isEdited: false, unit: "mm" },
      { id: "thickness", label: "Min. Wall Thickness",value:"38",                          originalValue: "40",                           confidence: "low",    reviewStatus: "pending", isEdited: true,  unit: "mm" },
      { id: "draft",     label: "Draft Angle",      value: "2°",                           originalValue: "2°",                           confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "machining_allow",label:"Machining Allowance",value:"6",                       originalValue: "6",                            confidence: "medium", reviewStatus: "pending", isEdited: false, unit: "mm" },
    ],
  },
  {
    id: "quality",
    title: "Quality & Heat Treatment",
    fields: [
      { id: "pour_temp", label: "Pouring Temperature",value:"1380–1420",                  originalValue: "1380–1420",                    confidence: "medium", reviewStatus: "pending", isEdited: false, unit: "°C" },
      { id: "hardness",  label: "Hardness",          value: "180–220 HB",                 originalValue: "180–220 HB",                   confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "heat_treat",label: "Heat Treatment",    value: "Stress Relieved 500°C",      originalValue: "Stress Relieved 500°C",        confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "ndt",       label: "NDT Method",        value: "UT + Visual",                 originalValue: "UT + Visual",                  confidence: "medium", reviewStatus: "pending", isEdited: false },
      { id: "surface",   label: "Surface Finish",    value: "6.3 Ra (machined faces)",    originalValue: "6.3 Ra (machined faces)",      confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "standard",  label: "Standard",          value: "IS 210 / BS EN 1561",        originalValue: "IS 210 / BS EN 1561",          confidence: "high",   reviewStatus: "pending", isEdited: false },
      { id: "remarks",   label: "Remarks",           value: "MPI on critical weld-repair areas; customer hold point after rough machining", originalValue: "MPI on critical weld-repair areas; customer hold point after rough machining", confidence: "high", reviewStatus: "pending", isEdited: false },
    ],
  },
];

export const FOUNDRY_EXCEL_ROWS: ExcelRow[] = [
  { id: "r1",  line: 1,  description: "Pattern Making — Wood / Resin",        drawingRef: "DWG-2026-006-B", material: "Resin/Wood Pattern",           qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 145000,  isModified: false, isCalculated: false },
  { id: "r2",  line: 2,  description: "Sand Casting — Rough Body (Upper)",    drawingRef: "DWG-006-U",      material: "Grey CI IS 210 FG 260",         qty: 1, unit: "EA",  weightKg: 2240, ratePerKg: 465,  amount: 1041600, isModified: false, isCalculated: false },
  { id: "r3",  line: 3,  description: "Sand Casting — Rough Body (Lower)",    drawingRef: "DWG-006-L",      material: "Grey CI IS 210 FG 260",         qty: 1, unit: "EA",  weightKg: 2180, ratePerKg: 465,  amount: 1013700, isModified: false, isCalculated: false },
  { id: "r4",  line: 4,  description: "Fettling, Grinding & Dressing",        drawingRef: "—",              material: "Labour",                        qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 95000,   isModified: false, isCalculated: false },
  { id: "r5",  line: 5,  description: "Stress Relieving Heat Treatment",      drawingRef: "—",              material: "Process (Furnace)",             qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 72000,   isModified: true,  isCalculated: false },
  { id: "r6",  line: 6,  description: "CNC Rough Machining — Mating Faces",   drawingRef: "DWG-2026-006-B", material: "Labour (CNC)",                  qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 185000,  isModified: false, isCalculated: false },
  { id: "r7",  line: 7,  description: "Semi-Finish Boring — Bearing Bores",   drawingRef: "DWG-006-U",      material: "Labour (CNC Boring)",           qty: 4, unit: "EA",  weightKg: 0,    ratePerKg: 0,    amount: 68000,   isModified: false, isCalculated: false },
  { id: "r8",  line: 8,  description: "NDT — Ultrasonic + Visual Inspection", drawingRef: "—",              material: "Service",                       qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 55000,   isModified: false, isCalculated: false },
  { id: "r9",  line: 9,  description: "Primer + Epoxy Coating (2 Coats)",     drawingRef: "—",              material: "Consumables",                   qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 34500,   isModified: false, isCalculated: false },
  { id: "r10", line: 10, description: "Packing, Marking & Forwarding",        drawingRef: "—",              material: "Service",                       qty: 1, unit: "LOT", weightKg: 0,    ratePerKg: 0,    amount: 22000,   isModified: false, isCalculated: false },
];
