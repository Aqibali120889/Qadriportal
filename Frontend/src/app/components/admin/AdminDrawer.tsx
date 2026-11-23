import { X } from "lucide-react";
import type { ReactNode } from "react";

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export default function AdminDrawer({
  open, onClose, width = 440, title, subtitle, badge, footer, children,
}: AdminDrawerProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}
      <div
        className="fixed inset-y-0 right-0 z-50 bg-card border-l border-border flex flex-col shadow-[−16px_0_48px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out overflow-hidden"
        style={{ width, transform: open ? "translateX(0)" : `translateX(${width}px)` }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {badge && <div className="flex items-center gap-1.5 flex-wrap mb-1.5">{badge}</div>}
              <h3 className="text-sm font-bold text-foreground leading-snug">{title}</h3>
              {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0 transition-all mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-muted/20">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
