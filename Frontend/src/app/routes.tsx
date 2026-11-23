import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

// Cost Estimation
import CELayout from "./layouts/CELayout";
import Dashboard from "./pages/Dashboard";
import DrawingWorkspace from "./pages/DrawingWorkspace";
import AIAssistant from "./pages/AIAssistant";
import CEHistoryPage from "./pages/cost-estimation/CEHistoryPage";
import CESettingsPage from "./pages/cost-estimation/CESettingsPage";
import CostEstimationSheet from "./pages/cost-estimation/CostEstimationSheet";
import EmailHub from "./pages/EmailHub";

// Foundry
import FoundryLayout from "./layouts/FoundryLayout";
import FoundryDashboard from "./pages/foundry/FoundryDashboard";
import FoundryWorkspace from "./pages/FoundryWorkspace";
import FoundryAIAssistant from "./pages/foundry/FoundryAIAssistant";
import FoundryHistoryPage from "./pages/foundry/FoundryHistoryPage";
import FoundrySettingsPage from "./pages/foundry/FoundrySettingsPage";

// Admin
import AdminLayout from "./components/admin/AdminLayout";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ProjectsPage from "./pages/admin/ProjectsPage";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import UsersPage from "./pages/admin/UsersPage";
import KanbanPage from "./pages/admin/KanbanPage";
import HistoryPage from "./pages/admin/HistoryPage";
import SettingsPage from "./pages/admin/SettingsPage";

import FoundryEmailHub from "./pages/foundry/FoundryEmailHub";

export const router = createBrowserRouter([
  // ── Public routes (no auth required) ───────────────────────────────────────
  { path: "/",                Component: Login          },
  { path: "/forgot-password", Component: ForgotPassword },
  { path: "/reset-password",  Component: ResetPassword  },

  // ── Cost Estimation workspace (requires authentication) ─────────────────────
  {
    path: "/dashboard",
    element: <ProtectedRoute><CELayout /></ProtectedRoute>,
    children: [
      { index: true,               Component: Dashboard        },
      { path: "drawing-workspace", Component: DrawingWorkspace },
      { path: "ai-assistant",      Component: AIAssistant      },
      { path: "history",           Component: CEHistoryPage    },
      { path: "settings",          Component: CESettingsPage   },
      { path: "email-hub",         Component: EmailHub         },
      { path: "rfq-sheet/:rfqId?", Component: CostEstimationSheet },
    ],
  },

  // ── Foundry workspace (requires authentication) ────────────────────────────
  {
    path: "/foundry",
    element: <ProtectedRoute><FoundryLayout /></ProtectedRoute>,
    children: [
      { index: true,          Component: FoundryDashboard    },
      { path: "workspace",    Component: FoundryWorkspace    },
      { path: "ai-assistant", Component: FoundryAIAssistant  },
      { path: "history",      Component: FoundryHistoryPage  },
      { path: "settings",     Component: FoundrySettingsPage },
      { path: "email-hub",    Component: FoundryEmailHub     },
      { path: "rfq-sheet/:rfqId?", Component: CostEstimationSheet },
    ],
  },

  // ── Admin (requires authentication + Super Admin role) ─────────────────────
  {
    path: "/admin",
    element: <ProtectedRoute requireSuperAdmin><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true,         Component: SuperAdminDashboard },
      { path: "projects",    Component: ProjectsPage        },
      { path: "departments", Component: DepartmentsPage     },
      { path: "users",       Component: UsersPage           },
      { path: "kanban",      Component: KanbanPage          },
      { path: "history",     Component: HistoryPage         },
      { path: "settings",    Component: SettingsPage        },
    ],
  },

  // ── Legacy URL redirects — must come after all real routes ─────────────────
  { path: "/foundry-workspace",   Component: () => Navigate({ to: "/foundry/workspace",            replace: true }) },
  { path: "/drawing-workspace",   Component: () => Navigate({ to: "/dashboard/drawing-workspace",  replace: true }) },
  { path: "/ai-assistant",        Component: () => Navigate({ to: "/dashboard/ai-assistant",       replace: true }) },

  // ── Catch-all ──────────────────────────────────────────────────────────────
  { path: "*", Component: () => Navigate({ to: "/", replace: true }) },
]);
