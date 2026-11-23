import { useState } from "react";
import {
  Copy, RefreshCw, ThumbsUp, ThumbsDown, Share2,
  Edit3, CheckCircle, FileText, ExternalLink, Sparkles,
} from "lucide-react";
import type { Message, MessageSource } from "@/app/types/ai-assistant";
import { CONFIDENCE_CONFIG } from "@/app/types/workspace";

// ── Simple markdown renderer ───────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table block
    if (line.startsWith("|") && lines[i + 1]?.match(/^\|[-| ]+\|$/)) {
      const headers = line.split("|").filter((c) => c.trim()).map((c) => c.trim());
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").filter((c) => c.trim()).map((c) => c.trim()));
        i++;
      }
      nodes.push(
        <div key={`tbl-${i}`} className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-accent/50">
                {headers.map((h, j) => (
                  <th key={j} className="px-2.5 py-1.5 text-left font-semibold text-foreground border border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "" : "bg-accent/20"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 text-foreground border border-border whitespace-nowrap">
                      {inlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <pre key={`code-${i}`} className="bg-muted rounded-[8px] px-3 py-2.5 text-[11px] font-mono text-foreground overflow-x-auto my-2">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Heading 3
    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-foreground mt-3 mb-1">
          {inlineMarkdown(line.slice(4))}
        </h3>
      );
      i++; continue;
    }

    // Heading 2
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={`h2-${i}`} className="text-base font-bold text-foreground mt-2 mb-1.5">
          {inlineMarkdown(line.slice(3))}
        </h2>
      );
      i++; continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      nodes.push(
        <div key={`bq-${i}`} className="border-l-2 border-amber-400 pl-3 py-0.5 my-1.5">
          <p className="text-xs text-muted-foreground">{inlineMarkdown(line.slice(2))}</p>
        </div>
      );
      i++; continue;
    }

    // Bullet list accumulate
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-none space-y-0.5 my-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-xs text-foreground">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\./.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\./.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s*/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="space-y-0.5 my-1.5 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-xs text-foreground">
              <span className="font-semibold text-muted-foreground flex-shrink-0 min-w-[14px]">{j + 1}.</span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---") {
      nodes.push(<div key={`hr-${i}`} className="h-px bg-border my-2" />);
      i++; continue;
    }

    // Empty line
    if (!line.trim()) {
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={`p-${i}`} className="text-xs text-foreground leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="font-mono text-[10px] bg-muted px-1 py-px rounded text-foreground">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    return part;
  });
}

// ── Source chip ────────────────────────────────────────────────────────────
function SourceChip({ source }: { source: MessageSource }) {
  const typeColor: Record<string, string> = {
    drawing: "#3B82F6", excel: "#22C55E", pdf: "#EF4444",
    sop: "#8B5CF6", project: "#F59E0B", standard: "#64748B", catalog: "#10B981",
  };
  return (
    <a href="#" onClick={(e) => e.preventDefault()}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[10px] font-medium border border-border
        hover:bg-accent transition-colors text-foreground"
    >
      <FileText size={10} style={{ color: typeColor[source.type] ?? "#64748B" }} />
      {source.name}
      {source.page && <span className="text-muted-foreground">· {source.page}</span>}
      <ExternalLink size={9} className="text-muted-foreground" />
    </a>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
  onLike?: (liked: boolean) => void;
  onCopy?: () => void;
}

export default function MessageBubble({ message, onRegenerate, onLike, onCopy }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  function handleCopy() {
    navigator.clipboard.writeText(message.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[75%] flex flex-col items-end gap-1">
          <div className="bg-indigo-600 dark:bg-indigo-700 text-white rounded-[12px] rounded-br-[4px] px-3.5 py-2.5">
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-[10px] text-muted-foreground px-1">{message.timestamp}</span>
        </div>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ml-2 flex-shrink-0 mt-1"
          style={{ backgroundColor: "#3B82F6" }}>
          AA
        </div>
      </div>
    );
  }

  // Assistant message
  const conf = message.confidence ? CONFIDENCE_CONFIG[message.confidence] : null;

  return (
    <div className="flex gap-2.5 mb-4 group">
      {/* AI avatar */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: "rgba(245,130,31,0.12)" }}>
        <Sparkles size={12} style={{ color: "#F5821F" }} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-card border border-border rounded-[12px] rounded-tl-[4px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          {message.isStreaming ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Generating…</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderMarkdown(message.content)}
            </div>
          )}
        </div>

        {/* Meta row */}
        {!message.isStreaming && (
          <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">{message.timestamp}</span>

            {conf && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color: conf.color, backgroundColor: conf.bg }}>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: conf.color }} />
                {conf.label} confidence
              </span>
            )}

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 w-full">
                <span className="text-[10px] text-muted-foreground font-medium w-full">Sources:</span>
                {message.sources.map((src) => <SourceChip key={src.id} source={src} />)}
              </div>
            )}

            {/* Actions — visible on hover */}
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {[
                { icon: copied ? CheckCircle : Copy, label: "Copy", action: handleCopy, active: copied },
                { icon: RefreshCw, label: "Regenerate", action: onRegenerate ?? (() => {}) },
                { icon: ThumbsUp,  label: "Like",    action: () => onLike?.(true),  active: message.liked === true  },
                { icon: ThumbsDown,label: "Dislike", action: () => onLike?.(false), active: message.liked === false },
                { icon: Share2,    label: "Share",   action: () => {} },
                { icon: Edit3,     label: "Edit",    action: () => {} },
              ].map(({ icon: Icon, label, action, active }) => (
                <button
                  key={label}
                  onClick={(e) => { e.stopPropagation(); action(); }}
                  title={label}
                  className={`w-6 h-6 flex items-center justify-center rounded-[5px] transition-all
                    ${active
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                >
                  <Icon size={11} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
