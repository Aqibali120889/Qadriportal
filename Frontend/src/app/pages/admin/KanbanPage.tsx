/**
 * admin/KanbanPage.tsx
 * Phase 11 — Super Admin Global Kanban Page.
 *
 * Provides Super Admin with a global Kanban view of tasks across all departments
 * (Cost Estimation + Foundry), with department filtering and switching.
 */

import { useState, useEffect } from "react";
import KanbanTaskBoard from "@/app/components/kanban/KanbanTaskBoard";
import { adminApi, AdminDepartmentItem } from "@/app/services/admin";

export default function KanbanPage() {
  const [departments, setDepartments] = useState<AdminDepartmentItem[]>([]);

  useEffect(() => {
    adminApi.getDepartments({ page_size: 100 })
      .then((res) => setDepartments(res.items))
      .catch((err) => console.error("Failed to load departments for Kanban:", err));
  }, []);

  const deptList = departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
  }));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Global Task Management</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cross-department task board for Cost Estimation, Foundry, and enterprise workflows.
            </p>
          </div>
        </div>

        {/* Global Kanban Task Board */}
        <KanbanTaskBoard
          isSuperAdmin={true}
          availableDepts={deptList}
          accentColor="#F5821F"
        />
      </div>
    </main>
  );
}
