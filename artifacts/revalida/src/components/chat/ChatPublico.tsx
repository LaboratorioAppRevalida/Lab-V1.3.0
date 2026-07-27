import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Globe, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const TWENTY_FOUR_H_AGO = () => {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d.toISOString();
};

const MAX_MESSAGES = 200;

export function ChatPublico() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("public_messages")
      .select("id, sender_id, content, created_at, sender:profiles!sender_id(name, display_name, avatar_url)")
      .gte("created_at", TWENTY_FOUR_H_AGO())
      .order("created_at", { ascending: true })
      .limit(MAX_MESSAGES)
      .then(({ data }) => {
        if (data) setMessages(data as unknown as PublicMessage[]);
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    const ch = supabase
      .channel("public_messages_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_messages" },
        async (payload) => {
          const row = payload.new as { id: string; sender_id: string; content: string; created_at: string };
          if (row.sender_id === user.id) return;

          const { data: profile } = await supabase
            .from("profiles_public")
            .select("name, display_name, avatar_url")
            .eq("id", row.sender_id)
            .single();

          const msg: PublicMessage = {
            id:         row.id,
            sender_id:  row.sender_id,
            content:    row.content,
            created_at: row.created_at,
            sender:     profile as PublicMessage["sender"] ?? null,
          };

          setMessages((prev) => {
            const next = [...prev, msg];
            return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setDraft("");

    const { data, error } = await supabase
      .from("public_messages")
      .insert({ sender_id: user.id, content: text })
      .select("id, sender_id, content, created_at")
      .single();

    if (!error && data) {
      const optimistic: PublicMessage = {
        id:         (data as { id: string }).id,
        sender_id:  user.id,
        content:    text,
        created_at: (data as { created_at: string }).created_at,
        sender: {
          name:         user.name,
          display_name: user.displayName ?? null,
          avatar_url:   user.avatarUrl ?? null,
        },
      };
      setMessages((prev) => {
        const next = [...prev, optimistic];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }

    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const myId    = user?.id;
  const hasDraft = draft.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header Neon */}
      <header className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="p-[1px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
          <div className="w-10 h-10 rounded-[11px] bg-white dark:bg-[#0b0f17] flex items-center justify-center text-cyan-500">
            <Globe className="w-5 h-5" />
          </div>
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-wide">Chat Público</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Canal aberto para todos os participantes</p>
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 min-h-0 pr-1">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Seja o primeiro a iniciar a conversa pública!</p>
          </div>
        )}

        {messages.map((m) => {
          const isMe       = m.sender_id === myId;
          const senderName = m.sender?.display_name?.trim() || m.sender?.name?.trim() || "Usuário";
          const avatarUrl  = m.sender?.avatar_url ?? null;
          const time       = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          return (
            <div key={m.id} className={cn("flex items-end gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && (
                <div className="shrink-0 mb-1">
                  <UserAvatar name={senderName} avatarUrl={avatarUrl} size="sm" />
                </div>
              )}

              <div className={cn("flex flex-col gap-1 max-w-[75%]", isMe && "items-end")}>
                {!isMe && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2">{senderName}</span>
                )}

                <div className={cn(
                  "px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap rounded-2xl transition-all duration-300",
                  isMe
                    ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-br-xs font-medium"
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

      {/* Input de Envio estilo Barra de Pesquisa Neon (da imagem) */}
      <footer className="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative p-[1px] rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] dark:shadow-[0_0_25px_rgba(6,182,212,0.2)]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#0b0f17]">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Mensagem pública..."
              className="flex-1 h-10 px-3 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={!hasDraft || sending}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                hasDraft
                  ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] active:scale-95"
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