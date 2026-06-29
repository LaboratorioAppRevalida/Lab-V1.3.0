import { useEffect, useRef, useState, useCallback } from "react";
import { Globe, Search, MessageCircle, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPublico } from "./ChatPublico";
import { ChatPrivado } from "./ChatPrivado";
import { useChatUnread } from "@/contexts/ChatUnreadContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useTraining } from "@/contexts/TrainingContext";
import { UserAvatar } from "@/components/users/UserAvatar";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isFavorite: boolean;
};

type StatusBadgeProps = { status: "online" | "in_session" | "busy" | "offline" };

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
        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
        styles[status],
        pulse && "animate-pulse"
      )}
    />
  );
}

function statusLabel(s: StatusBadgeProps["status"]): string {
  if (s === "in_session") return "Em estação";
  if (s === "busy")       return "Ocupado";
  if (s === "offline")    return "Offline";
  return "Online";
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

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-violet-500 text-white shadow-[0_0_8px_rgba(139,92,246,0.7)]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AbaChatContainer() {
  const { user } = useAuth();
  const { onlineUsers } = useRealtime();
  const { users: trainingUsers } = useTraining();
  const { unreadPublic, unreadPrivate, resetPublic, resetPrivate } = useChatUnread();

  // "publico" | contactId | null
  const [activeChat, setActiveChat] = useState<"publico" | string | null>(() =>
    sessionStorage.getItem("chat_open_with") ? null : "publico"
  );
  const [contacts, setContacts]           = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build contact list from favorites + recent DMs ───────────────────────

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
      if (row.sender_id   !== user.id) dmIds.add(row.sender_id);
      if (row.receiver_id !== user.id) dmIds.add(row.receiver_id);
    }

    const allIds = Array.from(new Set([...favIds, ...dmIds]));
    if (allIds.length === 0) { setContacts([]); return; }

    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("id, name, display_name, avatar_url")
      .in("id", allIds);

    const list: Contact[] = (profiles ?? []).map(
      (p: { id: string; name: string; display_name: string | null; avatar_url: string | null }) => ({
        id:        p.id,
        name:      p.display_name?.trim() || p.name?.trim() || "Usuário",
        avatarUrl: p.avatar_url ?? null,
        isFavorite: favIds.includes(p.id),
      })
    );

    list.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    setContacts(list);
  }, [user, trainingUsers]);

  useEffect(() => { void buildContacts(); }, [buildContacts]);

  // ── Deep-link: open contact injected via sessionStorage ──────────────────

  useEffect(() => {
    const targetId = sessionStorage.getItem("chat_open_with");
    if (!targetId || !user) return;
    sessionStorage.removeItem("chat_open_with");

    supabase
      .from("profiles_public")
      .select("id, name, display_name, avatar_url")
      .eq("id", targetId)
      .single()
      .then(({ data: p }) => {
        if (!p) return;
        const c: Contact = {
          id:        p.id,
          name:      (p.display_name as string | null)?.trim() || (p.name as string)?.trim() || "Usuário",
          avatarUrl: (p.avatar_url as string | null) ?? null,
          isFavorite: false,
        };
        setContacts((prev) => prev.find((x) => x.id === c.id) ? prev : [c, ...prev]);
        setActiveChat(targetId);
      });
  }, [user]);

  // ── Search all users in platform ─────────────────────────────────────────

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setIsSearching(false); return; }

    setIsSearching(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("id, name, display_name, avatar_url")
        .or(`name.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(20);

      setSearchResults(
        (data ?? []).map((p: { id: string; name: string; display_name: string | null; avatar_url: string | null }) => ({
          id:        p.id,
          name:      p.display_name?.trim() || p.name?.trim() || "Usuário",
          avatarUrl: p.avatar_url ?? null,
          isFavorite: contacts.some((c) => c.id === p.id && c.isFavorite),
        }))
      );
      setIsSearching(false);
    }, 300);

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, user, contacts]);

  // ── Reset unread when switching ───────────────────────────────────────────

  useEffect(() => {
    if (activeChat === "publico") resetPublic();
    else if (activeChat !== null) resetPrivate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat]);

  // ── Open contact ──────────────────────────────────────────────────────────

  const openContact = (c: Contact) => {
    if (!contacts.find((x) => x.id === c.id)) {
      setContacts((prev) => [c, ...prev]);
    }
    setActiveChat(c.id);
    setSearchQuery("");
    setSearchResults([]);
  };

  const activeContact = contacts.find((c) => c.id === activeChat) ?? null;
  const showConversation = activeChat !== null;
  const showSidebar = !showConversation; // mobile: sidebar OR convo

  const displayList = searchQuery.trim() ? searchResults : contacts;

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const sidebar = (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0",
        // Mobile: full width unless conversation open
        "w-full md:w-72 lg:w-80",
        // Glass panel
        "bg-white/5 dark:bg-slate-950/60",
        "border-r border-white/8 dark:border-white/5",
        "backdrop-blur-xl"
      )}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Mensagens</h2>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Procurar usuário..."
            className={cn(
              "w-full pl-9 pr-9 py-2.5 rounded-2xl text-sm",
              "bg-black/10 dark:bg-white/5",
              "border border-white/10 dark:border-white/6",
              "text-foreground placeholder:text-muted-foreground/50",
              "focus:outline-none focus:border-violet-400/40 focus:bg-black/15 dark:focus:bg-white/8",
              "transition-all duration-200"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned: Chat Público */}
      {!searchQuery.trim() && (
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => setActiveChat("publico")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left",
              "transition-all duration-200 group",
              activeChat === "publico"
                ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/15 border border-violet-400/25 shadow-[0_2px_16px_rgba(139,92,246,0.15)]"
                : "bg-white/5 dark:bg-white/3 border border-white/8 hover:bg-white/10 dark:hover:bg-white/6 hover:border-white/15"
            )}
          >
            {/* Globe icon as "avatar" */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              "bg-gradient-to-br from-violet-500/30 to-indigo-500/25",
              "border border-violet-400/30",
              activeChat === "publico" && "shadow-[0_0_12px_rgba(139,92,246,0.4)]"
            )}>
              <Globe className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground">Chat Público</div>
              <div className="text-[11px] text-muted-foreground/70 truncate">Canal aberto para todos</div>
            </div>
            <UnreadBadge count={unreadPublic} />
          </button>
        </div>
      )}

      {/* Separator */}
      {!searchQuery.trim() && contacts.length > 0 && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Privado</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
        </div>
      )}

      {/* Contact / search list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {isSearching && (
          <div className="flex justify-center py-8 text-muted-foreground/50 text-xs">Buscando…</div>
        )}

        {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-center">
            <Search className="w-7 h-7 opacity-20" />
            <p className="text-xs font-medium">Nenhum usuário encontrado</p>
          </div>
        )}

        {!isSearching && !searchQuery.trim() && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground text-center px-4">
            <MessageCircle className="w-9 h-9 opacity-15" />
            <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
            <p className="text-xs opacity-60 leading-relaxed">
              Use a busca acima para encontrar colegas e iniciar uma conversa privada.
            </p>
          </div>
        )}

        {!isSearching && displayList.length > 0 && (
          <ul className="flex flex-col gap-1">
            {displayList.map((c) => {
              const status = resolveStatus(c.id, onlineUsers);
              const isActive = activeChat === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => openContact(c)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left",
                      "transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-violet-600/18 to-indigo-600/12 border border-violet-400/22 shadow-[0_2px_12px_rgba(139,92,246,0.12)]"
                        : "bg-transparent border border-transparent hover:bg-white/6 dark:hover:bg-white/4 hover:border-white/10"
                    )}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size="md" />
                      <StatusDot status={status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{c.name}</div>
                      <div className={cn(
                        "text-[11px] font-medium",
                        status === "online"     && "text-emerald-500 dark:text-emerald-400",
                        status === "in_session" && "text-amber-500 dark:text-amber-400",
                        status === "busy"       && "text-orange-500 dark:text-orange-400",
                        status === "offline"    && "text-muted-foreground/60"
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

      {/* Footer notice */}
      <div className="px-4 py-2 shrink-0 border-t border-white/6">
        <p className="text-[9px] text-muted-foreground/40 text-center">
          Público: 24 h · Privado: 7 dias
        </p>
      </div>
    </aside>
  );

  // ── Conversation panel ─────────────────────────────────────────────────────

  const conversationPanel = (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {activeChat === null ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground select-none px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 dark:bg-white/3 border border-white/8 flex items-center justify-center">
            <MessageCircle className="w-7 h-7 opacity-30" />
          </div>
          <div>
            <p className="font-semibold text-sm">Selecione uma conversa</p>
            <p className="text-xs opacity-60 mt-1">Escolha o Chat Público ou uma conversa privada ao lado.</p>
          </div>
        </div>
      ) : activeChat === "publico" ? (
        <ChatPublico />
      ) : (
        activeContact && (
          <ChatPrivado
            activeId={activeChat}
            contact={activeContact}
            onBack={() => setActiveChat(null)}
          />
        )
      )}
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-68px-64px)] min-h-0 rounded-2xl overflow-hidden",
        "bg-black/5 dark:bg-slate-950/40 backdrop-blur-xl",
        "border border-white/8 dark:border-white/5",
        "shadow-2xl shadow-black/20"
      )}
    >
      {/* Mobile: show sidebar OR conversation */}
      <div className={cn("md:flex flex-col min-h-0 w-full md:w-auto", showConversation ? "hidden md:flex" : "flex")}>
        {sidebar}
      </div>

      {/* Mobile: conversation takes full width */}
      <div className={cn("md:flex flex-1 flex-col min-h-0", showConversation ? "flex" : "hidden md:flex")}>
        {/* Mobile back button injected at top when in a conversation (non-public) */}
        {showConversation && activeChat !== "publico" && activeContact && (
          <div className="md:hidden flex items-center gap-3 px-3 py-2.5 shrink-0 border-b border-white/8 bg-black/5 dark:bg-black/15 backdrop-blur-sm">
            <button
              onClick={() => setActiveChat(null)}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative shrink-0">
              <UserAvatar name={activeContact.name} avatarUrl={activeContact.avatarUrl} size="sm" />
              <StatusDot status={resolveStatus(activeChat, onlineUsers)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{activeContact.name}</div>
              <div className={cn(
                "text-[10px] font-medium",
                resolveStatus(activeChat, onlineUsers) === "online"     && "text-emerald-500",
                resolveStatus(activeChat, onlineUsers) === "in_session" && "text-amber-500",
                resolveStatus(activeChat, onlineUsers) === "busy"       && "text-orange-500",
                resolveStatus(activeChat, onlineUsers) === "offline"    && "text-muted-foreground"
              )}>
                {statusLabel(resolveStatus(activeChat, onlineUsers))}
              </div>
            </div>
          </div>
        )}
        {showConversation && activeChat === "publico" && (
          <div className="md:hidden flex items-center gap-3 px-3 py-2.5 shrink-0 border-b border-white/8 bg-black/5 dark:bg-black/15 backdrop-blur-sm">
            <button
              onClick={() => setActiveChat(null)}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500/30 to-indigo-500/25 border border-violet-400/30 shrink-0">
              <Globe className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Chat Público</div>
              <div className="text-[10px] text-muted-foreground/70">Canal aberto para todos</div>
            </div>
          </div>
        )}
        {conversationPanel}
      </div>
    </div>
  );
}
