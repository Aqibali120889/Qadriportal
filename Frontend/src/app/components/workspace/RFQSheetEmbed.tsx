import { useState, useEffect, useCallback } from "react";
import {
  Calculator, Download, RotateCcw, FileSpreadsheet, Plus, Loader2, Save, Search,
} from "lucide-react";
import {
  rfqApi,
  type FullRFQ,
  type RFQSession,
  type FoundryItem,
  type MachiningItem,
  type VendorItem,
  type PurchaseItem,
  type HeatTreatItem,
  type CompetitionRow,
  type ExportShipment,
} from "@/app/services/rfq";

import SectionCard from "./rfq/SectionCard";
import HeaderSection from "./rfq/HeaderSection";
import FoundrySection from "./rfq/FoundrySection";
import MachiningSection from "./rfq/MachiningSection";
import VendorSection from "./rfq/VendorSection";
import OverheadSection from "./rfq/OverheadSection";
import PatternSection from "./rfq/PatternSection";
import PurchaseSection from "./rfq/PurchaseSection";
import HeatTreatSection from "./rfq/HeatTreatSection";
import OtherCostsSection from "./rfq/OtherCostsSection";
import SolarSubsidySection from "./rfq/SolarSubsidySection";
import TaxSection from "./rfq/TaxSection";
import SummarySection from "./rfq/SummarySection";
import CompetitionSection from "./rfq/CompetitionSection";
import SignoffSection from "./rfq/SignoffSection";
import ExportShipmentTab from "./rfq/ExportShipmentTab";
import CostReportTab from "./rfq/CostReportTab";
import PHChargesTab from "./rfq/PHChargesTab";
import ShippingTab from "./rfq/ShippingTab";

const TABS = [
  { id: "cws",      label: "Cost Work Sheet" },
  { id: "export",   label: "Export Shipment" },
  { id: "report",   label: "Cost Report" },
  { id: "ph",       label: "P&H Charges" },
  { id: "shipping", label: "Shipping" },
] as const;

type TabId = typeof TABS[number]["id"];

interface RFQSheetEmbedProps {
  rfqId?: string | null;
  rfqNumber?: string | null;
  projectId?: string | null;
}

export default function RFQSheetEmbed({ rfqId: externalRfqId, rfqNumber: externalRfqNumber, projectId }: RFQSheetEmbedProps) {
  const [activeRfqId, setActiveRfqId] = useState<string | null>(externalRfqId ?? null);
  const [activeRfqNum, setActiveRfqNum] = useState<string | null>(externalRfqNumber ?? null);

  const [rfq, setRfq] = useState<RFQSession | null>(null);
  const [foundry, setFoundry] = useState<FoundryItem[]>([]);
  const [machining, setMachining] = useState<MachiningItem[]>([]);
  const [vendor, setVendor] = useState<VendorItem[]>([]);
  const [purchase, setPurchase] = useState<PurchaseItem[]>([]);
  const [heatTreat, setHeatTreat] = useState<HeatTreatItem[]>([]);
  const [competition, setCompetition] = useState<CompetitionRow[]>([]);
  const [exportShip, setExportShip] = useState<ExportShipment | null>(null);
  const [calc, setCalc] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("cws");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [sessions, setSessions] = useState<RFQSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [rfqSearch, setRfqSearch] = useState("");
  const [searchResults, setSearchResults] = useState<RFQSession[] | null>(null);

  // Auto-resolve project → RFQ session when projectId is provided
  useEffect(() => {
    if (!projectId) return;
    rfqApi.getOrCreateForProject(projectId)
      .then((bridge) => {
        if (bridge?.rfq_id) {
          setActiveRfqId(bridge.rfq_id);
          setActiveRfqNum(bridge.rfq_number);
        }
      })
      .catch((e) => console.warn("Project→RFQ bridge failed:", e));
  }, [projectId]);

  useEffect(() => {
    if (externalRfqId && externalRfqId !== activeRfqId) {
      setActiveRfqId(externalRfqId);
      setActiveRfqNum(externalRfqNumber ?? null);
    }
  }, [externalRfqId, externalRfqNumber]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await rfqApi.getSessions();
      const res = list.data || [];
      setSessions(res);
      if (!activeRfqId && res.length > 0) {
        setActiveRfqId(res[0].id);
        setActiveRfqNum(res[0].rfq_number);
      }
    } catch (e: any) {
      console.warn("Failed to load sessions:", e);
    } finally {
      setSessionsLoading(false);
    }
  }, [activeRfqId]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadRFQData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const full = await rfqApi.getFullRFQ(id);
      setRfq(full.rfq);
      setFoundry(full.foundry || []);
      setMachining(full.machining || []);
      setVendor(full.vendor || []);
      setPurchase(full.purchase || []);
      setHeatTreat(full.heat_treat || []);
      setCompetition(full.competition || []);
      setExportShip(full.export_shipment || null);
      setCalc(full.calculated || null);
    } catch (e: any) {
      setError("API Error: " + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeRfqId) {
      loadRFQData(activeRfqId);
    }
  }, [activeRfqId, loadRFQData]);

  // Phase 7: Listen for rfq:refresh events dispatched by DrawingWorkspace after an approval.
  // Silently reloads the full RFQ data so approved AI values appear in the sheet immediately.
  useEffect(() => {
    const handleRfqRefresh = () => {
      if (activeRfqId) {
        loadRFQData(activeRfqId);
      }
    };
    window.addEventListener("rfq:refresh", handleRfqRefresh);
    return () => window.removeEventListener("rfq:refresh", handleRfqRefresh);
  }, [activeRfqId, loadRFQData]);

  const triggerRecalc = async () => {
    if (!activeRfqId) return;
    try {
      const res = await rfqApi.calculate(activeRfqId);
      if (res.data) setCalc(res.data);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Calculation refresh failed:", e);
    }
  };

  const handleDownload = async () => {
    if (!activeRfqId || !rfq) return;
    try {
      await rfqApi.downloadExcel(activeRfqId, rfq.rfq_number);
    } catch (e: any) {
      alert("Download failed: " + e.message);
    }
  };

  const handleCreateNew = async () => {
    setLoading(true);
    try {
      const res = await rfqApi.createSession();
      if (res.data) {
        setActiveRfqId(res.data.id);
        setActiveRfqNum(res.data.rfq_number);
        await loadSessions();
      }
    } catch (e: any) {
      alert("Create failed: " + e.message);
      setLoading(false);
    }
  };

  const handleRfqSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqSearch.trim()) { setSearchResults(null); return; }
    try {
      const res = await rfqApi.getSessions(rfqSearch.trim());
      const results = res.data || [];
      setSearchResults(results);
      if (results.length === 1) {
        setActiveRfqId(results[0].id);
        setActiveRfqNum(results[0].rfq_number);
        setSearchResults(null);
        setRfqSearch("");
      }
    } catch (e: any) {
      console.warn("Search failed:", e);
    }
  };

  const modCount = [
    ...foundry, ...machining, ...vendor, ...purchase, ...heatTreat,
  ].filter((i: any) => i.is_modified).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col shadow-sm">
      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-sm text-foreground flex items-center gap-2">
              Cost Estimation Sheet
              {activeRfqId && (
                <select
                  value={activeRfqId}
                  onChange={(e) => {
                    const sel = sessions.find((s) => s.id === e.target.value);
                    if (sel) {
                      setActiveRfqId(sel.id);
                      setActiveRfqNum(sel.rfq_number);
                    }
                  }}
                  className="h-6 px-2 text-xs font-semibold rounded border border-border bg-background text-foreground cursor-pointer outline-none"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rfq_number} — {s.customer_name || s.item_name || "Untitled"}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>{rfq?.rfq_number}</span>
              {rfq?.customer_name && <span>· {rfq.customer_name}</span>}
              {rfq?.item_name && <span>· {rfq.item_name}</span>}
              {modCount > 0 && (
                <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {modCount} modified
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* RFQ Number Search */}
          <form onSubmit={handleRfqSearch} className="flex items-center gap-1 relative">
            <input
              type="text"
              value={rfqSearch}
              onChange={(e) => { setRfqSearch(e.target.value); if (!e.target.value) setSearchResults(null); }}
              placeholder="Search RFQ #..."
              className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground outline-none w-36 placeholder:text-muted-foreground focus:border-emerald-500"
            />
            <button type="submit" className="h-7 px-2 rounded border border-border bg-background hover:bg-accent transition-all">
              <Search size={12} className="text-muted-foreground" />
            </button>
            {searchResults && searchResults.length > 0 && (
              <div className="absolute top-8 left-0 z-50 bg-card border border-border rounded-lg shadow-lg min-w-[220px] py-1">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-all"
                    onClick={() => { setActiveRfqId(s.id); setActiveRfqNum(s.rfq_number); setSearchResults(null); setRfqSearch(""); }}
                  >
                    <span className="font-semibold">{s.rfq_number}</span>
                    {s.customer_name && <span className="text-muted-foreground ml-1">— {s.customer_name}</span>}
                  </button>
                ))}
              </div>
            )}
            {searchResults && searchResults.length === 0 && (
              <div className="absolute top-8 left-0 z-50 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs text-muted-foreground">
                No RFQ found for "{rfqSearch}"
              </div>
            )}
          </form>
          {lastSaved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Saved {lastSaved}</span>}
          <button
            onClick={handleCreateNew}
            className="h-8 px-3 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 transition-all"
            style={{ backgroundColor: "#F5821F" }}
          >
            <Plus size={13} /> New RFQ Session
          </button>
          <button
            onClick={() => activeRfqId && loadRFQData(activeRfqId)}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={!rfq}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground bg-card hover:bg-accent transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={13} /> Download Excel
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 bg-card border-b border-border sticky top-[53px] z-9 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-[#f4f5f7] dark:bg-card">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="animate-spin text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-muted-foreground">Loading Cost Estimation Sheet…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-center max-w-md">
              <p className="font-semibold text-red-600 dark:text-red-400 text-sm">⚠ Error</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <button
                onClick={() => activeRfqId && loadRFQData(activeRfqId)}
                className="mt-3 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "cws" && (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 px-4 py-2 bg-accent/20 border-b border-border text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-yellow-100 border border-amber-400 inline-block" />
                    <span>Modified cell</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-50 border border-blue-300 inline-block" />
                    <span>Calculated (read-only)</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Double-click any cell to edit
                  </span>
                </div>

                {/* 14 Sections */}
                <div className="p-4 space-y-4">
                  {/* 1. RFQ Header */}
                  <SectionCard title="RFQ Header" elementNum="—">
                    <HeaderSection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 2. Foundry Cost */}
                  <SectionCard
                    title="Foundry Cost"
                    elementNum={1}
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addFoundry(targetId).then((r) => {
                        setFoundry((p) => [...p, r.data]);
                        triggerRecalc();
                      });
                    }}
                    addLabel="Add Foundry Row"
                  >
                    <FoundrySection items={foundry} rfqId={rfq?.id} onChange={setFoundry} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 3. In-House Machining Cost */}
                  <SectionCard
                    title="In-House Machining Cost"
                    elementNum={2}
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addMachining(targetId).then((r) => {
                        setMachining((p) => [...p, r.data]);
                        triggerRecalc();
                      });
                    }}
                    addLabel="Add Operation"
                  >
                    <MachiningSection items={machining} rfqId={rfq?.id} onChange={setMachining} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 4. Vendor Machining Cost */}
                  <SectionCard
                    title="Vendor Machining Cost"
                    elementNum={3}
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addVendor(targetId).then((r) => {
                        setVendor((p) => [...p, r.data]);
                        triggerRecalc();
                      });
                    }}
                    addLabel="Add Vendor Row"
                  >
                    <VendorSection items={vendor} rfqId={rfq?.id} onChange={setVendor} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 5. QG Corporate Overhead */}
                  <SectionCard title="QG Corporate Overhead" elementNum={4}>
                    <OverheadSection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 6. Pattern / Tooling Cost */}
                  <SectionCard title="Pattern / Tooling Cost" elementNum={5}>
                    <PatternSection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 7. Purchase Cost — Misc Items */}
                  <SectionCard
                    title="Purchase Cost — Misc Items"
                    elementNum={6}
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addPurchase(targetId).then((r) => {
                        setPurchase((p) => [...p, r.data]);
                        triggerRecalc();
                      });
                    }}
                    addLabel="Add Purchase Row"
                  >
                    <PurchaseSection items={purchase} rfqId={rfq?.id} onChange={setPurchase} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 8. Heat Treatment Cost — Special */}
                  <SectionCard
                    title="Heat Treatment Cost — Special"
                    elementNum={7}
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addHeatTreat(targetId).then((r) => {
                        setHeatTreat((p) => [...p, r.data]);
                        triggerRecalc();
                      });
                    }}
                    addLabel="Add Heat Treat Row"
                  >
                    <HeatTreatSection items={heatTreat} rfqId={rfq?.id} onChange={setHeatTreat} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 9. Other Costs */}
                  <SectionCard title="Other Costs" elementNum={8}>
                    <OtherCostsSection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 10. Solar Cost Subsidy */}
                  <SectionCard title="Solar Cost Subsidy" elementNum={9}>
                    <SolarSubsidySection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 11. Income Tax */}
                  <SectionCard title="Income Tax" elementNum={10}>
                    <TaxSection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 12. Summary & Pricing */}
                  <SectionCard title="Summary & Pricing" elementNum="—">
                    <SummarySection rfq={rfq} onChange={setRfq} calc={calc} onRecalc={triggerRecalc} />
                  </SectionCard>

                  {/* 13. Competition Data */}
                  <SectionCard
                    title="Competition Data"
                    elementNum="—"
                    onAdd={() => {
                      const targetId = rfq?.id || activeRfqId;
                      if (!targetId) return;
                      rfqApi.addCompetition(targetId).then((r) => setCompetition((p) => [...p, r.data]));
                    }}
                    addLabel="Add Competition Row"
                  >
                    <CompetitionSection items={competition} rfqId={rfq?.id} onChange={setCompetition} />
                  </SectionCard>

                  {/* 14. Sign Off */}
                  <SectionCard title="Sign Off" elementNum="—">
                    <SignoffSection rfq={rfq} onChange={setRfq} />
                  </SectionCard>
                </div>
              </>
            )}

            {activeTab === "export" && (
              <ExportShipmentTab rfq={rfq} exportShipment={exportShip} onUpdate={setExportShip} />
            )}

            {activeTab === "report" && <CostReportTab />}
            {activeTab === "ph" && <PHChargesTab />}
            {activeTab === "shipping" && <ShippingTab />}
          </>
        )}
      </div>

      {/* ── Bottom Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border sticky bottom-0">
        <span className="text-xs text-muted-foreground">
          RFQ Dashboard v3.0 {lastSaved ? `· Last saved: ${lastSaved}` : ""}
        </span>
        <button
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#F5821F" }}
        >
          ↗ Submit to Next Department
        </button>
      </div>
    </div>
  );
}
