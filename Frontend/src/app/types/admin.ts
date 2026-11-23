import type { LucideIcon } from "lucide-react";

export type Priority = "critical" | "high" | "medium" | "low";
export type ProjectStatus = "new" | "in-progress" | "in-review" | "pending" | "completed" | "delayed";
export type ServiceStatus = "operational" | "degraded" | "down";

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#F59E0B",
  low:      "#6B7280",
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  "new":         "#6B7280",
  "in-progress": "#3B82F6",
  "in-review":   "#F59E0B",
  "pending":     "#F97316",
  "completed":   "#22C55E",
  "delayed":     "#EF4444",
};

export function getDeptColor(dept: string): string {
  const map: Record<string, string> = {
    "Marketing":        "#8B5CF6",
    "Cost Estimation":  "#3B82F6",
    "Foundry":          "#F59E0B",
    "QEN":              "#10B981",
    "Fabrication":      "#EF4444",
    "Admin":            "#F5821F",
    "Reports":          "#6366F1",
  };
  return map[dept] ?? "#6B7280";
}

export function getUserAvatarColor(initials: string): string {
  const map: Record<string, string> = {
    AA: "#3B82F6", BK: "#8B5CF6", ZA: "#10B981",
    HR: "#F59E0B", FN: "#EF4444", MU: "#F5821F", KS: "#6366F1",
  };
  return map[initials] ?? "#6B7280";
}

// ── DB Status helpers ─────────────────────────────────────────────────────────

export const DB_STATUS_DISPLAY: Record<string, ProjectStatus> = {
  DRAFT:     "new",
  ACTIVE:    "in-progress",
  ON_HOLD:   "pending",
  COMPLETED: "completed",
  CANCELLED: "delayed",
};

export const DB_STATUS_PROGRESS: Record<string, number> = {
  DRAFT:     10,
  ACTIVE:    50,
  ON_HOLD:   30,
  COMPLETED: 100,
  CANCELLED: 0,
};

// ── Re-export admin service types for convenience ─────────────────────────────

export type {
  AdminStatistics,
  AdminDeptStat,
  AdminMonthlyTrend,
  AdminRecentProject,
  AdminRecentNotification,
  AdminDashboardResponse,
  AdminProjectItem,
  AdminProjectsResponse,
  AdminProjectsParams,
  AdminCustomer,
} from "@/app/services/admin";

// ── Misc interface shapes kept for backward compatibility ─────────────────────

export type ActivityIconKey = "cpu" | "check" | "file" | "mail" | "arrow" | "folder" | "user" | "shield" | "alert";

export interface SystemService {
  id: string;
  name: string;
  status: ServiceStatus;
  metric: string;
  detail: string;
  iconKey: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "error" | "success";
  route?: string | null;
}
