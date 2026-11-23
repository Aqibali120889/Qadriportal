export type Priority = "Critical" | "High" | "Medium" | "Low";
export type ColumnId = "pending" | "in-progress" | "review" | "completed";

export interface Engineer {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Task {
  id: string;
  rfqId: string;
  customer: string;
  projectName: string;
  priority: Priority;
  dueDate: string;
  assignee: Engineer;
  attachments: number;
  comments: number;
  status: ColumnId;
  progress: number;
  description?: string;
  drawingNumber?: string | null;
  drawingStatus?: string;   // NONE | RECEIVED
  aiStatus?: string;        // NONE | QUEUED | PROCESSING | COMPLETED | FAILED
  hasExcelSession?: boolean;
}

export interface Column {
  id: ColumnId;
  title: string;
  accent: string;
  darkAccent: string;
}

export const COLUMNS: Column[] = [
  { id: "pending",     title: "Pending",     accent: "#64748B", darkAccent: "#94A3B8" },
  { id: "in-progress", title: "In Progress", accent: "#3B82F6", darkAccent: "#60A5FA" },
  { id: "review",      title: "Review",      accent: "#F59E0B", darkAccent: "#FBBF24" },
  { id: "completed",   title: "Completed",   accent: "#22C55E", darkAccent: "#4ADE80" },
];

export const ENGINEERS: Engineer[] = [
  { id: "e1", name: "Aqib Ali",     initials: "AA", color: "#3B82F6" },
  { id: "e2", name: "Bilal Khan",   initials: "BK", color: "#8B5CF6" },
  { id: "e3", name: "Zara Ahmed",   initials: "ZA", color: "#EC4899" },
  { id: "e4", name: "Hassan Raza",  initials: "HR", color: "#10B981" },
  { id: "e5", name: "Fatima Noor",  initials: "FN", color: "#F59E0B" },
];

export const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; darkBg: string }> = {
  Critical: { color: "#EF4444", bg: "#FEF2F2", darkBg: "rgba(239,68,68,0.12)" },
  High:     { color: "#F97316", bg: "#FFF7ED", darkBg: "rgba(249,115,22,0.12)" },
  Medium:   { color: "#D97706", bg: "#FFFBEB", darkBg: "rgba(217,119,6,0.12)"  },
  Low:      { color: "#64748B", bg: "#F8FAFC", darkBg: "rgba(100,116,139,0.12)" },
};

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1", rfqId: "RFQ-2026-001", customer: "Lucky Cement",
    projectName: "Crusher Housing Assembly", priority: "High",
    dueDate: "2026-07-15", assignee: ENGINEERS[0],
    attachments: 2, comments: 3, status: "pending", progress: 0,
  },
  {
    id: "t2", rfqId: "RFQ-2026-002", customer: "DG Cement",
    projectName: "Kiln Drive Gearbox", priority: "Critical",
    dueDate: "2026-07-14", assignee: ENGINEERS[1],
    attachments: 1, comments: 0, status: "pending", progress: 0,
  },
  {
    id: "t3", rfqId: "RFQ-2026-003", customer: "Maple Leaf Cement",
    projectName: "Ball Mill Liner Set", priority: "Medium",
    dueDate: "2026-07-20", assignee: ENGINEERS[2],
    attachments: 0, comments: 1, status: "pending", progress: 0,
  },
  {
    id: "t4", rfqId: "RFQ-2026-004", customer: "Pioneer Cement",
    projectName: "Preheater Tower Casing", priority: "High",
    dueDate: "2026-07-16", assignee: ENGINEERS[3],
    attachments: 3, comments: 5, status: "in-progress", progress: 45,
  },
  {
    id: "t5", rfqId: "RFQ-2026-005", customer: "Bestway Cement",
    projectName: "Raw Mill Air Separator", priority: "Medium",
    dueDate: "2026-07-18", assignee: ENGINEERS[0],
    attachments: 2, comments: 2, status: "in-progress", progress: 70,
  },
  {
    id: "t6", rfqId: "RFQ-2026-006", customer: "Cherat Cement",
    projectName: "Clinker Cooler Frame", priority: "Critical",
    dueDate: "2026-07-13", assignee: ENGINEERS[4],
    attachments: 4, comments: 8, status: "in-progress", progress: 20,
  },
  {
    id: "t7", rfqId: "RFQ-2026-007", customer: "Power Cement",
    projectName: "Cement Storage Silo", priority: "Low",
    dueDate: "2026-07-22", assignee: ENGINEERS[1],
    attachments: 1, comments: 3, status: "review", progress: 90,
  },
  {
    id: "t8", rfqId: "RFQ-2026-008", customer: "Flying Cement",
    projectName: "Conveyor Belt System", priority: "High",
    dueDate: "2026-07-15", assignee: ENGINEERS[2],
    attachments: 2, comments: 6, status: "review", progress: 85,
  },
  {
    id: "t9", rfqId: "RFQ-2026-009", customer: "Askari Cement",
    projectName: "Rotary Kiln Shell", priority: "Critical",
    dueDate: "2026-07-23", assignee: ENGINEERS[3],
    attachments: 2, comments: 1, status: "review", progress: 60,
  },
  {
    id: "t10", rfqId: "RFQ-2026-010", customer: "Lucky Cement",
    projectName: "Fan Housing Unit", priority: "Medium",
    dueDate: "2026-07-10", assignee: ENGINEERS[3],
    attachments: 3, comments: 4, status: "completed", progress: 100,
  },
  {
    id: "t11", rfqId: "RFQ-2026-011", customer: "Askari Cement",
    projectName: "Screw Conveyor Shaft", priority: "Low",
    dueDate: "2026-07-09", assignee: ENGINEERS[0],
    attachments: 1, comments: 2, status: "completed", progress: 100,
  },
  {
    id: "t12", rfqId: "RFQ-2026-012", customer: "Fauji Cement",
    projectName: "Vertical Roller Mill", priority: "High",
    dueDate: "2026-07-11", assignee: ENGINEERS[2],
    attachments: 5, comments: 7, status: "completed", progress: 100,
  },
];
