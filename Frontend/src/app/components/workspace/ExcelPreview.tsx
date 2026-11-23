import { useState, useCallback } from "react";
import {
  Save, RotateCcw, Download, RefreshCw, Calculator,
} from "lucide-react";
import type { ExcelRow } from "@/app/types/workspace";

interface ExcelPreviewProps {
  rows: ExcelRow[];
  onRowChange: (id: string, field: keyof ExcelRow, value: string | number) => void;
  onReset: () => void;
  onSave: () => void;
  onDownload: () => void;
  onGenerate: () => void;
}

const HEADERS = [
  { key: "line",        label: "#",            width: 40,   align: "center" as const },
  { key: "description", label: "Description",  width: 220,  align: "left"   as const },
  { key: "drawingRef",  label: "Dwg. Ref",     width: 100,  align: "left"   as const },
  { key: "material",    label: "Material / Spec",width: 180, align: "left"  as const },
  { key: "qty",         label: "Qty",           width: 50,   align: "center" as const },
  { key: "unit",        label: "Unit",          width: 55,   align: "center" as const },
  { key: "weightKg",   label: "Weight (kg)",   width: 90,   align: "right"  as const },
  { key: "ratePerKg",  label: "Rate (PKR/kg)", width: 100,  align: "right"  as const },
  { key: "amount",     label: "Amount (PKR)",  width: 120,  align: "right"  as const },
];

const NUMERIC_COLS = new Set(["qty", "weightKg", "ratePerKg", "amount"]);
const READONLY_COLS = new Set(["line", "amount"]);

function formatNum(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("en-PK");
}

interface CellProps {
  value: string | number;
  colKey: string;
  align: "left" | "center" | "right";
  isModified: boolean;
  isCalculated: boolean;
  onEdit: (v: string) => void;
  isDark: boolean;
}

function Cell({ value, colKey, align, isModified, isCalculated, onEdit, isDark }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const readOnly = READONLY_COLS.has(colKey) || isCalculated;

  const display = NUMERIC_COLS.has(colKey) && colKey !== "qty" && colKey !== "weightKg"
    ? formatNum(Number(value))
    : String(value);

  const cellBg = isCalculated
    ? (isDark ? "rgba(59,130,246,0.08)" : "rgba(219,234,254,0.6)")
    : isModified
    ? (isDark ? "rgba(245,158,11,0.10)" : "rgba(254,249,195,0.8)")
    : "transparent";

  if (editing && !readOnly) {
    return (
      <input
        autoFocus
        className="w-full h-full px-1.5 text-xs text-foreground bg-white dark:bg-gray-800 border border-primary/60 focus:outline-none"
        style={{ textAlign: align }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onEdit(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { onEdit(draft); setEditing(false); }
          if (e.key === "Escape") { setEditing(false); }
        }}
      />
    );
  }

  return (
    <div
      className={`px-1.5 py-1 text-xs leading-tight truncate h-full flex items-center
        ${readOnly ? "cursor-default" : "cursor-text hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"}
        ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}
      style={{ backgroundColor: cellBg }}
      onDoubleClick={() => {
        if (!readOnly) {
          setDraft(String(value));
          setEditing(true);
        }
      }}
    >
      <span className={`${colKey === "amount" ? "font-semibold" : ""} ${isCalculated ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
        {display}
      </span>
      {isModified && !isCalculated && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1 flex-shrink-0" title="Modified" />
      )}
    </div>
  );
}

export default function ExcelPreview({ rows, onRowChange, onReset, onSave, onDownload, onGenerate }: ExcelPreviewProps) {
  const [isDark] = useState(() => document.documentElement.classList.contains("dark"));

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  const modifiedCount = rows.filter((r) => r.isModified).length;

  return (
    <div className="border border-border rounded-[12px] overflow-hidden bg-card shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Calculator size={13} style={{ color: "#22C55E" }} />
          <span className="text-xs font-semibold text-foreground">Cost Estimation Sheet</span>
          {modifiedCount > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
              {modifiedCount} modified
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground hidden sm:block">Double-click a cell to edit</span>
          <div className="w-px h-4 bg-border" />
          <button onClick={onSave}     className="h-7 px-2.5 rounded-[7px] text-xs font-medium text-foreground border border-border hover:bg-accent transition-all flex items-center gap-1.5"><Save size={11} />Save</button>
          <button onClick={onReset}    className="h-7 px-2.5 rounded-[7px] text-xs font-medium text-muted-foreground border border-border hover:bg-accent transition-all flex items-center gap-1.5"><RotateCcw size={11} />Reset</button>
          <button onClick={onDownload} className="h-7 px-2.5 rounded-[7px] text-xs font-medium text-foreground border border-border hover:bg-accent transition-all flex items-center gap-1.5"><Download size={11} />Download</button>
          <button
            onClick={onGenerate}
            className="h-7 px-2.5 rounded-[7px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
            style={{ backgroundColor: "#22C55E" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16A34A")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#22C55E")}
          >
            <RefreshCw size={11} />Generate
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border bg-accent/20">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(254,249,195,0.8)" }} />
          Modified cell
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(219,234,254,0.6)" }} />
          Calculated (read-only)
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {rows.length} line items
        </span>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 960 }}>
          {/* Header row */}
          <thead>
            <tr className="bg-accent/40 border-b border-border sticky top-0 z-10">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  className="border-r border-border last:border-r-0 px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground select-none"
                  style={{ width: h.width, textAlign: h.align }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors"
                style={{ backgroundColor: rowIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)" }}
              >
                {HEADERS.map((h) => {
                  const key = h.key as keyof ExcelRow;
                  const val = row[key] as string | number;
                  const isCalc = key === "amount";
                  return (
                    <td key={h.key} className="border-r border-border last:border-r-0 p-0" style={{ height: 32, width: h.width }}>
                      <Cell
                        value={val}
                        colKey={h.key}
                        align={h.align}
                        isModified={row.isModified && !isCalc}
                        isCalculated={isCalc}
                        isDark={isDark}
                        onEdit={(v) => {
                          const num = NUMERIC_COLS.has(h.key) ? Number(v) || 0 : v;
                          onRowChange(row.id, key, num);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Totals row */}
            <tr className="border-t-2 border-border bg-accent/40 font-semibold">
              <td colSpan={7} className="px-2 py-2 text-xs font-bold text-foreground text-right border-r border-border">
                Total Estimated Cost
              </td>
              <td className="px-1.5 py-2 border-r border-border" />
              <td className="px-1.5 py-2 text-xs font-bold text-right" style={{ color: "#F5821F" }}>
                PKR {totalAmount.toLocaleString("en-PK")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-card">
        <p className="text-[10px] text-muted-foreground">
          Auto-populated from AI extraction · Last saved: just now
        </p>
        <p className="text-[10px] font-semibold" style={{ color: "#F5821F" }}>
          Total: PKR {totalAmount.toLocaleString("en-PK")}
        </p>
      </div>
    </div>
  );
}
