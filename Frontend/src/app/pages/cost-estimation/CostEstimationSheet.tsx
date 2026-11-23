/**
 * Frontend/src/app/pages/cost-estimation/CostEstimationSheet.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Full-page Cost Estimation Sheet.
 * Loaded via /dashboard/rfq-sheet/:rfqId route.
 *
 * Renders the complete RFQSheetEmbed workspace component containing all 5 tabs:
 * - Cost Work Sheet (14 Sections)
 * - Export Shipment
 * - Cost Report
 * - P&H Charges
 * - Shipping
 */

import { useParams, useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import RFQSheetEmbed from "@/app/components/workspace/RFQSheetEmbed";

export default function CostEstimationSheet() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-7 px-2.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-accent transition-all flex items-center gap-1.5"
          >
            <ChevronLeft size={13} />
            Back to Dashboard
          </button>
          <span className="text-sm font-bold text-foreground">RFQ Cost Estimation Workspace</span>
        </div>
      </div>

      {/* RFQ Workspace Embed */}
      <div className="flex-1 overflow-y-auto p-3">
        <RFQSheetEmbed rfqId={rfqId} />
      </div>
    </div>
  );
}
