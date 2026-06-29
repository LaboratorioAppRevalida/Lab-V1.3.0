import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Send } from "lucide-react";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load history on mount ─────────────────────────────────────────────────

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

  // ── Realtime: new messages from other users ───────────────────────────────

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

  // ── Send ──────────────────────────────────────────────────────────────────

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

  const myId = user?.id;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3 min-h-0 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
            <span className="text-4xl">💬</span>
            <p className="text-sm font-semibold">Nenhuma mensagem ainda</p>
            <p className="text-xs text-center opacity-70">Seja o primeiro a iniciar a conversa pública!</p>
          </div>
        )}

        {messages.map((m) => {
          const isMe       = m.sender_id === myId;
          const senderName = m.sender?.display_name?.trim() || m.sender?.name?.trim() || "Usuário";
          const avatarUrl  = m.sender?.avatar_url ?? null;

          return (
            <div key={m.id} className={cn("flex items-end gap-2", isMe && "flex-row-reverse")}>
              {!isMe && <UserAvatar name={senderName} avatarUrl={avatarUrl} size="sm" />}

              <div className={cn("flex flex-col gap-0.5 max-w-[72%]", isMe && "items-end")}>
                {!isMe && (
                  <span className="text-[10px] font-semibold text-muted-foreground/80 px-1">
                    {senderName}
                  </span>
                )}

                <div
                  className={cn(
                    "px-3.5 py-2.5 rounded-2xl text-sm leading-snug break-words whitespace-pre-wrap backdrop-blur-sm",
                    "transition-all duration-200",
                    isMe
                      ? [
                          "bg-gradient-to-br from-violet-500/30 to-indigo-500/25",
                          "border border-violet-400/30",
                          "text-foreground",
                          "shadow-[0_2px_16px_rgba(139,92,246,0.25)]",
                          "rounded-br-sm",
                        ].join(" ")
                      : [
                          "bg-white/8 dark:bg-white/5",
                          "border border-white/10",
                          "text-foreground",
                          "shadow-sm",
                          "rounded-bl-sm",
                        ].join(" ")
                  )}
                >
                  {m.content}
                </div>

                <span className="text-[9px] text-muted-foreground/60 px-1">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/8 px-3 py-3 flex items-end gap-2 shrink-0
                      bg-black/5 dark:bg-black/10 backdrop-blur-sm">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Mensagem pública…"
          rows={1}
          maxLength={500}
          className={cn(
            "flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-sm",
            "bg-white/5 dark:bg-black/20 backdrop-blur-sm",
            "border border-white/10",
            "text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:border-violet-400/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.25)]",
            "transition-all duration-200 min-h-[40px] max-h-[120px]"
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          onClick={() => void send()}
          disabled={!draft.trim() || sending}
          aria-label="Enviar"
          className={cn(
            "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center",
            "bg-gradient-to-br from-violet-600 to-indigo-600",
            "text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]",
            "disabled:opacity-40 disabled:shadow-none",
            "hover:shadow-[0_0_20px_rgba(139,92,246,0.7)]",
            "transition-all duration-200"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
