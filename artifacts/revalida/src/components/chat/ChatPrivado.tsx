import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

const SEVEN_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

function StatusDot({ status }: StatusBadgeProps) {
  const styles: Record<StatusBadgeProps["status"], string> = {
    online:     "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    in_session: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
    busy:       "bg-rose-500 shadow-[0_0_8px_#f43f5e]",
    offline:    "bg-slate-400 border-2 border-white dark:border-[#0f172a]",
  };
  return (
    <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0f172a]", styles[status])} />
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

export function ChatPrivado({ activeId, contact }: Props) {
  const { user }        = useAuth();
  const { onlineUsers } = useRealtime();

  const [messages, setMessages]       = useState<PrivateMessage[]>([]);
  const [draft, setDraft]             = useState("");
  const [sending, setSending]         = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const subRef    = useRef<RealtimeChannel | null>(null);

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header do Contato */}
      <header className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative">
          <UserAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="md" />
          <StatusDot status={peerStatus} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">{contact.name}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">{statusLabel(peerStatus)}</p>
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 min-h-0 pr-1">
        {loadingMsgs && (
          <div className="text-center py-6 text-xs text-slate-400 animate-pulse">Carregando histórico...</div>
        )}

        {!loadingMsgs && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Inicie a conversa!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Envie a primeira mensagem privada.</p>
          </div>
        )}

        {!loadingMsgs && messages.map((m) => {
          const isMe = m.sender_id === myId;
          const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          return (
            <div key={m.id} className={cn("flex items-end gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && (
                <div className="shrink-0 mb-1">
                  <UserAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="sm" />
                </div>
              )}

              <div className={cn("flex flex-col gap-1 max-w-[75%]", isMe && "items-end")}>
                <div className={cn(
                  "px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap rounded-2xl transition-all duration-300",
                  isMe
                    ? "bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] rounded-br-xs font-medium"
                    : "bg-white dark:bg-[#121826] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800/80 shadow-sm rounded-bl-xs"
                )}>
                  {m.content}
                </div>
                <span className="text-[9px] text-slate-400 dark:text-slate-600 px-1">{time}</span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input de Envio estilo Barra de Pesquisa Neon */}
      <footer className="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative p-[1px] rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 shadow-[0_0_20px_rgba(99,102,241,0.25)] dark:shadow-[0_0_25px_rgba(6,182,212,0.2)]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#0b0f17]">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Mensagem privada..."
              className="flex-1 h-10 px-3 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={!hasDraft || sending}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                hasDraft
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] active:scale-95"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}