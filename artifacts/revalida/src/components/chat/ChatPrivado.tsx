import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Send, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isFavorite: boolean;
};

type PrivateMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

type StatusBadgeProps = { status: "online" | "in_session" | "busy" | "offline" };

type Props = {
  activeId: string;
  contact: Contact;
  onBack: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVEN_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

function StatusDot({ status }: StatusBadgeProps) {
  const styles: Record<StatusBadgeProps["status"], string> = {
    online:     "bg-emerald-500 shadow-[0_0_6px_#10B981]",
    in_session: "bg-amber-500  shadow-[0_0_6px_#F59E0B]",
    busy:       "bg-orange-500 shadow-[0_0_6px_#F97316]",
    offline:    "bg-slate-400/50 dark:bg-slate-600/60",
  };
  const pulse = status !== "offline";
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
        styles[status],
        pulse && "animate-pulse"
      )}
    />
  );
}

function resolveStatus(
  userId: string,
  onlineUsers: { user_id: string; status: string }[]
): StatusBadgeProps["status"] {
  const u = onlineUsers.find((o) => o.user_id === userId);
  if (!u) return "offline";
  if (u.status === "in_session") return "in_session";
  if (u.status === "busy")       return "busy";
  return "online";
}

function statusLabel(s: StatusBadgeProps["status"]): string {
  if (s === "in_session") return "Em estação";
  if (s === "busy")       return "Ocupado";
  if (s === "offline")    return "Offline";
  return "Online";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPrivado({ activeId, contact, onBack }: Props) {
  const { user }        = useAuth();
  const { onlineUsers } = useRealtime();

  const [messages, setMessages]       = useState<PrivateMessage[]>([]);
  const [draft, setDraft]             = useState("");
  const [sending, setSending]         = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const subRef    = useRef<RealtimeChannel | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load messages when activeId changes ──────────────────────────────────

  useEffect(() => {
    if (!activeId || !user) { setMessages([]); return; }
    setLoadingMsgs(true);
    supabase
      .from("private_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${activeId}),` +
        `and(sender_id.eq.${activeId},receiver_id.eq.${user.id})`
      )
      .gte("created_at", SEVEN_DAYS_AGO())
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        setMessages((data ?? []) as PrivateMessage[]);
        setLoadingMsgs(false);
      });
  }, [activeId, user]);

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!activeId || !user) return;
    if (subRef.current) { supabase.removeChannel(subRef.current); subRef.current = null; }

    const ch = supabase
      .channel(`dm:${[user.id, activeId].sort().join("-")}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "private_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as PrivateMessage;
          if (msg.sender_id !== activeId) return;
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    subRef.current = ch;
    return () => { supabase.removeChannel(ch); subRef.current = null; };
  }, [activeId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ─────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [draft]);

  // ── Send ─────────────────────────────────────────────────────────────────

  const send = async () => {
    const text = draft.trim();
    if (!text || !user || !activeId || sending) return;
    setSending(true);
    setDraft("");

    const { data, error } = await supabase
      .from("private_messages")
      .insert({ sender_id: user.id, receiver_id: activeId, content: text })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as PrivateMessage]);
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const peerStatus = resolveStatus(activeId, onlineUsers);
  const myId = user?.id ?? "";
  const hasDraft = draft.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Conversation header (desktop) ── */}
      <div className={cn(
        "hidden md:flex items-center gap-3 px-4 py-3 shrink-0",
        "border-b border-white/8 dark:border-white/5",
        "bg-white/5 dark:bg-black/20 backdrop-blur-sm"
      )}>
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl hover:bg-white/10 dark:hover:bg-white/8 transition-colors shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="relative shrink-0">
          <UserAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="sm" />
          <StatusDot status={peerStatus} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate text-foreground">{contact.name}</div>
          <div className={cn(
            "text-[10px] font-medium",
            peerStatus === "online"     && "text-emerald-500",
            peerStatus === "in_session" && "text-amber-500",
            peerStatus === "busy"       && "text-orange-500",
            peerStatus === "offline"    && "text-muted-foreground/60"
          )}>
            {statusLabel(peerStatus)}
          </div>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        {loadingMsgs && (
          <div className="flex justify-center py-8">
            <span className="text-xs text-muted-foreground/50 animate-pulse">Carregando mensagens…</span>
          </div>
        )}

        {!loadingMsgs && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-center select-none">
            <span className="text-3xl">👋</span>
            <p className="text-sm font-semibold">Inicie a conversa!</p>
            <p className="text-xs opacity-60">Seja a primeira mensagem entre vocês.</p>
          </div>
        )}

        {messages.map((m) => {
          const isMe = m.sender_id === myId;
          const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && (
                <div className="shrink-0 mb-4">
                  <UserAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="sm" />
                </div>
              )}
              <div className={cn("flex flex-col gap-1 max-w-[76%]", isMe && "items-end")}>
                <div className={cn(
                  "px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
                  "transition-all duration-200",
                  isMe
                    ? [
                        "bg-gradient-to-br from-violet-600 to-indigo-600",
                        "text-white",
                        "rounded-2xl rounded-br-none",
                        "shadow-[0_4px_20px_rgba(139,92,246,0.35)]",
                      ].join(" ")
                    : [
                        "bg-white/80 dark:bg-slate-900/60",
                        "backdrop-blur-md",
                        "border border-slate-200/60 dark:border-white/10",
                        "text-foreground",
                        "rounded-2xl rounded-bl-none",
                        "shadow-sm",
                      ].join(" ")
                )}>
                  {m.content}
                </div>
                <span className="text-[9px] text-muted-foreground/50 px-1">{time}</span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Input footer ── */}
      <div className={cn(
        "shrink-0 px-3 py-3 flex items-end gap-2",
        "border-t border-white/8 dark:border-white/5",
        "bg-white/5 dark:bg-black/15 backdrop-blur-sm"
      )}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Mensagem privada…"
          rows={1}
          maxLength={2000}
          className={cn(
            "flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm",
            "bg-black/8 dark:bg-white/5",
            "border border-white/10 dark:border-white/8",
            "text-foreground placeholder:text-muted-foreground/40",
            "focus:outline-none focus:border-violet-400/50 focus:bg-black/12 dark:focus:bg-white/8",
            "focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]",
            "transition-all duration-200 min-h-[42px] max-h-[120px]",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          )}
        />
        <button
          onClick={() => void send()}
          disabled={!hasDraft || sending}
          aria-label="Enviar mensagem"
          className={cn(
            "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200",
            hasDraft
              ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_4px_16px_rgba(139,92,246,0.45)] hover:shadow-[0_4px_24px_rgba(139,92,246,0.65)] hover:scale-105 active:scale-95"
              : "bg-white/8 dark:bg-white/5 text-muted-foreground/40 border border-white/10 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
