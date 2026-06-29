import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useTraining } from "@/contexts/TrainingContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Send, ChevronLeft, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

const SEVEN_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

function StatusDot({ status }: StatusBadgeProps) {
  const styles: Record<StatusBadgeProps["status"], string> = {
    online:     "bg-emerald-500 shadow-[0_0_8px_#10B981]",
    in_session: "bg-amber-500  shadow-[0_0_8px_#F59E0B]",
    busy:       "bg-orange-500 shadow-[0_0_8px_#F97316]",
    offline:    "bg-muted-foreground/40",
  };
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
        styles[status]
      )}
      title={status}
    />
  );
}

function statusLabel(status: StatusBadgeProps["status"]): string {
  switch (status) {
    case "in_session": return "em estação";
    case "offline":    return "offline";
    case "busy":       return "ocupado";
    default:           return "online";
  }
}

function resolveStatus(userId: string, onlineUsers: { user_id: string; status: string }[]): StatusBadgeProps["status"] {
  const u = onlineUsers.find((o) => o.user_id === userId);
  if (!u) return "offline";
  if (u.status === "in_session") return "in_session";
  if (u.status === "busy")       return "busy";
  return "online";
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatPrivado() {
  const { user } = useAuth();
  const { onlineUsers } = useRealtime();
  const { users: trainingUsers } = useTraining();

  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [messages, setMessages]       = useState<PrivateMessage[]>([]);
  const [draft, setDraft]             = useState("");
  const [sending, setSending]         = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const subRef    = useRef<RealtimeChannel | null>(null);

  // ── Build contact list ──────────────────────────────────────────────────

  const buildContacts = useCallback(async () => {
    if (!user) return;

    const favIds = trainingUsers.filter((u) => u.favorito && u.isReal).map((u) => u.id);

    const { data: dmRows } = await supabase
      .from("private_messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .gte("created_at", SEVEN_DAYS_AGO())
      .limit(500);

    const dmIds = new Set<string>();
    for (const row of (dmRows ?? []) as { sender_id: string; receiver_id: string }[]) {
      if (row.sender_id  !== user.id) dmIds.add(row.sender_id);
      if (row.receiver_id !== user.id) dmIds.add(row.receiver_id);
    }

    const allIds = Array.from(new Set([...favIds, ...dmIds]));
    if (allIds.length === 0) { setContacts([]); return; }

    // profiles_public bypasses the own-row RLS on profiles
    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("id, name, display_name, avatar_url")
      .in("id", allIds);

    const list: Contact[] = (profiles ?? []).map((p: { id: string; name: string; display_name: string | null; avatar_url: string | null }) => ({
      id:         p.id,
      name:       p.display_name?.trim() || p.name?.trim() || "Usuário",
      avatarUrl:  p.avatar_url ?? null,
      isFavorite: favIds.includes(p.id),
    }));

    list.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    setContacts(list);
  }, [user, trainingUsers]);

  useEffect(() => { void buildContacts(); }, [buildContacts]);

  // ── Deep-link: open a contact injected via sessionStorage ───────────────

  useEffect(() => {
    const targetId = sessionStorage.getItem("chat_open_with");
    if (!targetId || !user) return;
    sessionStorage.removeItem("chat_open_with");

    // profiles_public bypasses the own-row RLS on profiles
    supabase
      .from("profiles_public")
      .select("id, name, display_name, avatar_url")
      .eq("id", targetId)
      .single()
      .then(({ data: p }) => {
        if (!p) return;
        const c: Contact = {
          id:         p.id,
          name:       (p.display_name as string | null)?.trim() || (p.name as string)?.trim() || "Usuário",
          avatarUrl:  (p.avatar_url as string | null) ?? null,
          isFavorite: false,
        };
        setContacts((prev) => {
          if (prev.find((x) => x.id === c.id)) return prev;
          return [c, ...prev];
        });
        setActiveId(targetId);
      });
  }, [user]);

  // ── Load messages when active contact changes ───────────────────────────

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

  // ── Realtime subscription for new messages ──────────────────────────────

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

  // ── Send message ────────────────────────────────────────────────────────

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
      void buildContacts();
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const activeContact = contacts.find((c) => c.id === activeId) ?? null;
  const myId = user?.id ?? "";

  // ── Render: contact list ────────────────────────────────────────────────

  if (!activeId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16 px-6 text-center">
              <MessageCircle className="w-10 h-10 opacity-20" />
              <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
              <p className="text-xs opacity-70">
                Favorite colegas na lista de treino ou visite o perfil deles para iniciar uma conversa privada.
              </p>
            </div>
          ) : (
            <ul className="p-2 flex flex-col gap-1">
              {contacts.map((c) => {
                const status = resolveStatus(c.id, onlineUsers);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left",
                        "bg-white/3 dark:bg-white/2 border border-white/5",
                        "hover:bg-white/8 dark:hover:bg-white/5",
                        "hover:border-white/15 hover:scale-[1.01]",
                        "hover:shadow-[0_4px_20px_rgba(139,92,246,0.15)]",
                        "transition-all duration-300"
                      )}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size="md" />
                        <StatusDot status={status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{c.name}</div>
                        <div className={cn(
                          "text-[11px] font-medium capitalize",
                          status === "online"     && "text-emerald-500 dark:text-emerald-400",
                          status === "in_session" && "text-amber-500 dark:text-amber-400",
                          status === "busy"       && "text-orange-500 dark:text-orange-400",
                          status === "offline"    && "text-muted-foreground"
                        )}>
                          {statusLabel(status)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ── Render: conversation ────────────────────────────────────────────────

  const peerStatus = resolveStatus(activeId, onlineUsers);

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header */}
      <div className="flex items-center gap-3 px-3 py-2.5 shrink-0
                      border-b border-white/8 bg-black/5 dark:bg-black/15 backdrop-blur-sm">
        <button
          onClick={() => setActiveId(null)}
          className="p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {activeContact && (
          <>
            <div className="relative shrink-0">
              <UserAvatar name={activeContact.name} avatarUrl={activeContact.avatarUrl} size="sm" />
              <StatusDot status={peerStatus} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{activeContact.name}</div>
              <div className={cn(
                "text-[10px] font-medium capitalize",
                peerStatus === "online"     && "text-emerald-500",
                peerStatus === "in_session" && "text-amber-500",
                peerStatus === "busy"       && "text-orange-500",
                peerStatus === "offline"    && "text-muted-foreground"
              )}>
                {statusLabel(peerStatus)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3 min-h-0">
        {loadingMsgs && (
          <div className="flex justify-center py-8 text-muted-foreground/60 text-sm">Carregando…</div>
        )}
        {!loadingMsgs && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-center">
            <span className="text-3xl">👋</span>
            <p className="text-sm font-semibold">Inicie a conversa!</p>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === myId;
          return (
            <div key={m.id} className={cn("flex items-end gap-2", isMe && "flex-row-reverse")}>
              <div className={cn("flex flex-col gap-0.5 max-w-[76%]", isMe && "items-end")}>
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
                          "text-foreground shadow-sm",
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
          placeholder="Mensagem privada…"
          rows={1}
          maxLength={2000}
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
