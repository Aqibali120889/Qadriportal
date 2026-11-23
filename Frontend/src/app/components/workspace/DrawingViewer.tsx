import { useState } from "react";
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw,
  Download, ChevronLeft, ChevronRight, Info, Move, FileText,
} from "lucide-react";

interface DrawingMeta {
  fileName?: string;
  pages?: number;
  drawingNumber?: string;
  revision?: string;
  title?: string;
}

interface DrawingViewerProps {
  isDark: boolean;
  pdfUrl?: string;
  drawingMeta?: DrawingMeta;
}

// Engineering drawing SVG — crusher housing front/side view with title block
function EngineeringDrawing({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? "#7DD3FC" : "#1E3A5F";
  const dim    = isDark ? "#60A5FA" : "#2563EB";
  const thin   = isDark ? "#93C5FD55" : "#1E3A5F44";
  const text   = isDark ? "#BAE6FD" : "#1E3A5F";
  const bg     = isDark ? "#0C1929" : "#F0F6FF";
  const grid   = isDark ? "#1E3A5F33" : "#BFDBFE44";

  return (
    <svg viewBox="0 0 720 540" xmlns="http://www.w3.org/2000/svg" style={{ backgroundColor: bg, width: "100%", height: "100%" }}>
      {/* Grid */}
      {Array.from({ length: 24 }).map((_, i) => (
        <line key={`gh${i}`} x1="0" y1={i * 22.5} x2="720" y2={i * 22.5} stroke={grid} strokeWidth="0.5" />
      ))}
      {Array.from({ length: 32 }).map((_, i) => (
        <line key={`gv${i}`} x1={i * 22.5} y1="0" x2={i * 22.5} y2="540" stroke={grid} strokeWidth="0.5" />
      ))}

      {/* Drawing border */}
      <rect x="10" y="10" width="700" height="520" fill="none" stroke={stroke} strokeWidth="1.5" />
      <rect x="16" y="16" width="688" height="508" fill="none" stroke={stroke} strokeWidth="0.5" />

      {/* Title block border */}
      <rect x="430" y="440" width="278" height="84" fill="none" stroke={stroke} strokeWidth="1" />
      <line x1="430" y1="460" x2="708" y2="460" stroke={stroke} strokeWidth="0.5" />
      <line x1="430" y1="475" x2="708" y2="475" stroke={stroke} strokeWidth="0.5" />
      <line x1="430" y1="490" x2="708" y2="490" stroke={stroke} strokeWidth="0.5" />
      <line x1="430" y1="510" x2="708" y2="510" stroke={stroke} strokeWidth="0.5" />
      <line x1="570" y1="440" x2="570" y2="524" stroke={stroke} strokeWidth="0.5" />

      {/* Title block text */}
      <text x="438" y="455" fontSize="7" fill={text} fontFamily="monospace">DRAWING NO.</text>
      <text x="578" y="455" fontSize="7" fill={text} fontFamily="monospace">REVISION</text>
      <text x="438" y="471" fontSize="8.5" fontWeight="bold" fill={stroke} fontFamily="monospace">DWG-2026-001-A</text>
      <text x="578" y="471" fontSize="8.5" fontWeight="bold" fill={stroke} fontFamily="monospace">Rev. 3</text>
      <text x="438" y="484" fontSize="7" fill={text} fontFamily="monospace">COMPONENT</text>
      <text x="438" y="498" fontSize="7.5" fontWeight="bold" fill={stroke} fontFamily="monospace">CRUSHER HOUSING ASSEMBLY</text>
      <text x="438" y="508" fontSize="7" fill={text} fontFamily="monospace">CUSTOMER</text>
      <text x="438" y="521" fontSize="7.5" fill={stroke} fontFamily="monospace">LUCKY CEMENT LIMITED</text>
      <text x="578" y="508" fontSize="7" fill={text} fontFamily="monospace">SCALE</text>
      <text x="578" y="521" fontSize="7.5" fill={stroke} fontFamily="monospace">1:10</text>

      {/* ── FRONT VIEW ── */}
      <text x="140" y="50" fontSize="8" fill={text} fontFamily="monospace" textAnchor="middle">FRONT VIEW</text>
      <line x1="60" y1="55" x2="220" y2="55" stroke={thin} strokeWidth="0.5" strokeDasharray="4 2" />

      {/* Main housing body */}
      <rect x="65" y="70" width="150" height="120" fill="none" stroke={stroke} strokeWidth="1.5" />
      {/* Upper flange */}
      <rect x="55" y="65" width="170" height="10" fill="none" stroke={stroke} strokeWidth="1.2" />
      {/* Lower flange */}
      <rect x="55" y="190" width="170" height="12" fill="none" stroke={stroke} strokeWidth="1.2" />
      {/* Bore circle */}
      <circle cx="140" cy="130" r="35" fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx="140" cy="130" r="5"  fill="none" stroke={stroke} strokeWidth="0.8" />
      {/* Center lines */}
      <line x1="140" y1="90" x2="140" y2="170" stroke={dim} strokeWidth="0.5" strokeDasharray="5 3" />
      <line x1="100" y1="130" x2="180" y2="130" stroke={dim} strokeWidth="0.5" strokeDasharray="5 3" />
      {/* Bolt holes */}
      {[80, 110, 140, 170, 200].map((x) => (
        <circle key={x} cx={x} cy={76} r="4" fill="none" stroke={stroke} strokeWidth="0.8" />
      ))}
      {/* Ribs */}
      <line x1="82" y1="75"  x2="82"  y2="190" stroke={stroke} strokeWidth="0.8" />
      <line x1="198" y1="75" x2="198" y2="190" stroke={stroke} strokeWidth="0.8" />
      {/* Section hatch */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`h${i}`} x1={70 + i * 10} y1="75" x2={65 + i * 10} y2="95"
          stroke={stroke} strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* DIMENSION — Width */}
      <line x1="55" y1="225" x2="225" y2="225" stroke={dim} strokeWidth="0.5" />
      <line x1="55" y1="202" x2="55"  y2="230" stroke={dim} strokeWidth="0.5" />
      <line x1="225" y1="202" x2="225" y2="230" stroke={dim} strokeWidth="0.5" />
      <polygon points="60,225 67,222 67,228" fill={dim} />
      <polygon points="220,225 213,222 213,228" fill={dim} />
      <text x="140" y="221" fontSize="7" fill={dim} fontFamily="monospace" textAnchor="middle">1200</text>

      {/* DIMENSION — Height */}
      <line x1="235" y1="65" x2="235" y2="202" stroke={dim} strokeWidth="0.5" />
      <line x1="225" y1="65"  x2="242" y2="65"  stroke={dim} strokeWidth="0.5" />
      <line x1="225" y1="202" x2="242" y2="202" stroke={dim} strokeWidth="0.5" />
      <polygon points="235,70 232,77 238,77" fill={dim} />
      <polygon points="235,197 232,190 238,190" fill={dim} />
      <text x="246" y="135" fontSize="7" fill={dim} fontFamily="monospace" textAnchor="start">980</text>

      {/* ── SIDE VIEW ── */}
      <text x="390" y="50" fontSize="8" fill={text} fontFamily="monospace" textAnchor="middle">SIDE VIEW</text>
      <line x1="310" y1="55" x2="420" y2="55" stroke={thin} strokeWidth="0.5" strokeDasharray="4 2" />

      {/* Side housing */}
      <rect x="315" y="70" width="150" height="120" fill="none" stroke={stroke} strokeWidth="1.5" />
      <rect x="305" y="65" width="170" height="10"  fill="none" stroke={stroke} strokeWidth="1.2" />
      <rect x="305" y="190" width="170" height="12" fill="none" stroke={stroke} strokeWidth="1.2" />
      {/* Wall thickness indicator */}
      <rect x="315" y="70" width="18" height="120" fill="none" stroke={stroke} strokeWidth="0.8" />
      <rect x="447" y="70" width="18" height="120" fill="none" stroke={stroke} strokeWidth="0.8" />
      {/* Section hatch side */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={`hs${i}`} x1={317 + i * 4} y1="72" x2={313 + i * 4} y2="92"
          stroke={stroke} strokeWidth="0.5" opacity="0.4" />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={`hs2${i}`} x1={449 + i * 4} y1="72" x2={445 + i * 4} y2="92"
          stroke={stroke} strokeWidth="0.5" opacity="0.4" />
      ))}
      {/* Center line */}
      <line x1="390" y1="62" x2="390" y2="210" stroke={dim} strokeWidth="0.5" strokeDasharray="5 3" />

      {/* DIMENSION — Length (side) */}
      <line x1="305" y1="225" x2="475" y2="225" stroke={dim} strokeWidth="0.5" />
      <line x1="305" y1="202" x2="305" y2="230" stroke={dim} strokeWidth="0.5" />
      <line x1="475" y1="202" x2="475" y2="230" stroke={dim} strokeWidth="0.5" />
      <polygon points="310,225 317,222 317,228" fill={dim} />
      <polygon points="470,225 463,222 463,228" fill={dim} />
      <text x="390" y="221" fontSize="7" fill={dim} fontFamily="monospace" textAnchor="middle">1850</text>

      {/* Wall thickness dim */}
      <line x1="293" y1="70"  x2="293" y2="190" stroke={dim} strokeWidth="0.5" />
      <line x1="293" y1="70"  x2="333" y2="70"  stroke={dim} strokeWidth="0.5" strokeDasharray="2 1" />
      <line x1="293" y1="190" x2="333" y2="190" stroke={dim} strokeWidth="0.5" strokeDasharray="2 1" />
      <text x="284" y="133" fontSize="6.5" fill={dim} fontFamily="monospace" textAnchor="middle" transform="rotate(-90 284 133)">t=45</text>

      {/* ── NOTES ── */}
      <rect x="24" y="440" width="400" height="84" fill="none" stroke={stroke} strokeWidth="0.8" />
      <text x="28" y="453" fontSize="7.5" fontWeight="bold" fill={stroke} fontFamily="monospace">GENERAL NOTES:</text>
      <text x="28" y="465" fontSize="6.5" fill={text} fontFamily="monospace">1. ALL DIMENSIONS IN mm UNLESS OTHERWISE STATED.</text>
      <text x="28" y="476" fontSize="6.5" fill={text} fontFamily="monospace">2. MATERIAL: CAST IRON ASTM A48 CLASS 35.</text>
      <text x="28" y="487" fontSize="6.5" fill={text} fontFamily="monospace">3. GENERAL TOLERANCE: ±0.5mm PER BS EN ISO 2768-m.</text>
      <text x="28" y="498" fontSize="6.5" fill={text} fontFamily="monospace">4. SURFACE FINISH: 3.2 Ra ON ALL MACHINED SURFACES.</text>
      <text x="28" y="509" fontSize="6.5" fill={text} fontFamily="monospace">5. HEAT TREATMENT: STRESS RELIEVED AT 550°C ± 15°C.</text>
      <text x="28" y="520" fontSize="6.5" fill={text} fontFamily="monospace">6. WITNESS INSPECTION REQUIRED BEFORE DESPATCH.</text>

      {/* ── DETAIL VIEW ── */}
      <text x="560" y="280" fontSize="7.5" fill={text} fontFamily="monospace" textAnchor="middle">DETAIL A — BORE</text>
      <circle cx="560" cy="330" r="45" fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx="560" cy="330" r="28" fill="none" stroke={stroke} strokeWidth="1" />
      <circle cx="560" cy="330" r="8"  fill="none" stroke={stroke} strokeWidth="0.8" />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return <circle key={i} cx={560 + Math.cos(angle) * 36} cy={330 + Math.sin(angle) * 36} r="4"
          fill="none" stroke={stroke} strokeWidth="0.8" />;
      })}
      <line x1="515" y1="330" x2="605" y2="330" stroke={dim} strokeWidth="0.5" strokeDasharray="5 2" />
      <line x1="560" y1="285" x2="560" y2="375" stroke={dim} strokeWidth="0.5" strokeDasharray="5 2" />
      <text x="560" y="385" fontSize="6.5" fill={dim} fontFamily="monospace" textAnchor="middle">∅320 H7</text>
      <text x="600" y="330" fontSize="6.5" fill={dim} fontFamily="monospace">∅90 PCD</text>

      {/* View reference circle */}
      <circle cx="140" cy="165" r="12" fill="none" stroke={stroke} strokeWidth="0.7" strokeDasharray="2 1" />
      <text x="140" y="169" fontSize="7" fill={stroke} fontFamily="monospace" textAnchor="middle">A</text>
      <line x1="152" y1="163" x2="505" y2="295" stroke={stroke} strokeWidth="0.5" strokeDasharray="3 2" opacity="0.5" />

      {/* Projection lines connecting views */}
      <line x1="220" y1="65"  x2="315" y2="65"  stroke={thin} strokeWidth="0.5" strokeDasharray="3 2" />
      <line x1="220" y1="202" x2="315" y2="202" stroke={thin} strokeWidth="0.5" strokeDasharray="3 2" />
    </svg>
  );
}

export default function DrawingViewer({ isDark, pdfUrl, drawingMeta }: DrawingViewerProps) {
  const [zoom, setZoom]         = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage]         = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const totalPages = drawingMeta?.pages || 3;

  function zoomIn()  { setZoom((z) => Math.min(z + 15, 200)); }
  function zoomOut() { setZoom((z) => Math.max(z - 15, 40));  }
  function fitScreen() { setZoom(100); setRotation(0); }
  function rotate()  { setRotation((r) => (r + 90) % 360); }

  return (
    <div className={`flex flex-col border border-border rounded-[12px] overflow-hidden bg-card shadow-[0_1px_6px_rgba(0,0,0,0.07)]
      ${fullscreen ? "fixed inset-4 z-50 shadow-2xl" : "h-full"}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card flex-shrink-0">
        <span className="text-xs font-semibold text-foreground mr-1">Drawing Viewer</span>
        <div className="w-px h-4 bg-border mx-1" />

        {/* Zoom controls */}
        <button onClick={zoomOut}  title="Zoom Out"   className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ZoomOut  size={13} /></button>
        <span className="text-[11px] font-mono font-semibold text-foreground min-w-[38px] text-center select-none">{zoom}%</span>
        <button onClick={zoomIn}   title="Zoom In"    className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ZoomIn   size={13} /></button>
        <button onClick={fitScreen} title="Fit Screen" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all text-[9px] font-bold">FIT</button>

        <div className="w-px h-4 bg-border mx-1" />

        <button onClick={rotate}    title="Rotate"     className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><RotateCw size={13} /></button>
        <button                     title="Pan"        className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><Move     size={13} /></button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Page navigation */}
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all disabled:opacity-30">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[11px] font-mono text-foreground select-none whitespace-nowrap">{page}/{totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all disabled:opacity-30">
          <ChevronRight size={13} />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            title="Drawing Info"
            className={`w-7 h-7 flex items-center justify-center rounded-[6px] transition-all ${infoOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <Info size={13} />
          </button>
          <button title="Download" className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><Download size={13} /></button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Info overlay */}
      {infoOpen && (
        <div className="flex-shrink-0 border-b border-border bg-accent/30 px-3 py-2">
          <div className="grid grid-cols-3 gap-x-6 gap-y-1">
            {[
              ["File",          drawingMeta?.fileName || "DWG-2026-001-A.pdf"],
              ["Drawing No",    drawingMeta?.drawingNumber || "—"],
              ["Revision",      drawingMeta?.revision || "—"],
              ["Title",         drawingMeta?.title || "—"],
              ["Pages",         String(totalPages)],
              ["Source",        pdfUrl ? "Live PDF" : "SVG Placeholder"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{k}:</span>
                <span className="text-[10px] font-semibold text-foreground truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawing area — real PDF iframe or SVG placeholder */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative"
        style={{ backgroundColor: isDark ? "#0A1929" : "#E8F0FE" }}>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="Engineering Drawing"
            className="w-full h-full rounded-lg shadow-lg border border-border"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform 0.3s",
              minHeight: 400,
            }}
          />
        ) : (
          <div
            className="transition-transform duration-300 origin-center"
            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
          >
            <EngineeringDrawing isDark={isDark} />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] text-muted-foreground"
              style={{ background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.1)" }}>
              <FileText size={10} /> Placeholder drawing — process project to load real PDF
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border bg-card">
        <span className="text-[10px] text-muted-foreground font-mono">
          {drawingMeta?.fileName || "No drawing loaded"} — Sheet {page} of {totalPages}
        </span>
        <span className="text-[10px] text-muted-foreground">Zoom: {zoom}%{rotation ? ` · Rotated: ${rotation}°` : ""}</span>
      </div>
    </div>
  );
}
