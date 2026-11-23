import { useEffect, useRef } from "react";
import { Sparkles, MessageSquare } from "lucide-react";
import type { Message, ContextChip } from "@/app/types/ai-assistant";
import { SUGGESTED_ACTIONS } from "@/app/types/ai-assistant";
import MessageBubble from "./MessageBubble";
import PromptInput from "./PromptInput";

interface ChatInterfaceProps {
  messages: Message[];
  isStreaming: boolean;
  contextChips: ContextChip[];
  onSend: (text: string, attachments: string[]) => void;
  onSendWithFile?: (text: string, file: File) => void;
  isSendingWithFile?: boolean;
  onRegenerate: (msgId: string) => void;
  onLike: (msgId: string, liked: boolean) => void;
  onRemoveChip: (id: string) => void;
  onSuggestedAction: (action: string) => void;
  conversationTitle: string;
}

function EmptyState({ onAction }: { onAction: (label: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(245,130,31,0.10)" }}>
        <Sparkles size={22} style={{ color: "#F5821F" }} />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">Qadri AI Assistant</h3>
      <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-6">
        Ask me anything about your engineering drawings, cost estimations, materials, or past projects.
      </p>

      {/* Suggested actions grid */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {SUGGESTED_ACTIONS.slice(0, 6).map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.label)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-xs font-medium text-foreground
              border border-border bg-card hover:bg-accent hover:border-border/80 transition-all text-left"
          >
            <span className="text-base leading-none flex-shrink-0">{action.icon}</span>
            <span className="leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatInterface({
  messages, isStreaming, contextChips, onSend, onSendWithFile, isSendingWithFile,
  onRegenerate, onLike, onRemoveChip, onSuggestedAction, conversationTitle,
}: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div className="flex flex-col h-full min-w-0 border-r border-l border-border bg-background">
      {/* Conversation title bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
        <MessageSquare size={14} className="text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">{conversationTitle}</span>
        {messages.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState onAction={onSuggestedAction} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRegenerate={() => onRegenerate(msg.id)}
                onLike={(liked) => onLike(msg.id, liked)}
              />
            ))}
            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex gap-2.5 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: "rgba(245,130,31,0.12)" }}>
                  <Sparkles size={12} style={{ color: "#F5821F" }} />
                </div>
                <div className="bg-card border border-border rounded-[12px] rounded-tl-[4px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">AI is thinking…</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <PromptInput
        onSend={onSend}
        onSendWithFile={onSendWithFile}
        isSendingWithFile={isSendingWithFile}
        disabled={isStreaming}
        contextChips={contextChips}
        onRemoveChip={onRemoveChip}
      />
    </div>
  );
}
