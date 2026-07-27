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

type Contact = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isFavorite: boolean;
};

type StatusBadgeProps = { status: "online" | "in_session" | "busy" | "offline" };

const SEVEN_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

function StatusDot({ status }: StatusBadgeProps) {
  const styles: Record<StatusBadgeProps["status"], string> = {
    online:     "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    in_session: "bg-amber-400 stroke-amber-200 shadow-[0_0_8px_#fbbf24]",
    busy:       "bg-rose-500 shadow-[0_0_8px_#f43f5e]",
    offline:    "bg-slate-400 border-2 border-[#121824] dark:border-slate-800",
  };
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#0f172a]",
        styles[status]
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
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AbaChatContainer() {
  const { user } = useAuth();
  const { onlineUsers } = useRealtime();
  const { users: trainingUsers } = useTraining();
  const { unreadPublic, unreadPrivate, resetPublic, resetPrivate } = useChatUnread();

  const [activeChat, setActiveChat] = useState<"publico" | string | null>(() =>
    sessionStorage.getItem("chat_open_with") ? null : "publico"
  );
  const [contacts, setContacts]           = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (activeChat === "publico") resetPublic();
    else if (activeChat !== null) resetPrivate();
  }, [activeChat, resetPublic, resetPrivate]);

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

  const displayList = searchQuery.trim() ? searchResults : contacts;

  return (
    <div className="flex w-full h-[calc(100dvh-68px-64px)] bg-slate-100/70 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 rounded-3xl p-4 md:p-6 gap-6 font-sans select-none overflow-hidden transition-colors duration-300">

      {/* SIDEBAR */}
      <aside className={cn(
        "flex flex-col h-full shrink-0 w-full md:w-72 lg:w-80 gap-5",
        showConversation ? "hidden md:flex" : "flex"
      )}>
        <div className="px-2 pt-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            Mensagens <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></span>
          </h1>
        </div>

        {/* Input de Busca Neon */}
        <div className="relative flex items-center group">
          <Search className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Procurar usuário..."
            className="w-full h-11 pl-11 pr-9 rounded-2xl bg-white/80 dark:bg-[#121826]/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm border border-slate-200 dark:border-slate-800 outline-none transition-all duration-300 focus:border-cyan-500 dark:focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.35)]"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Chat Público Fixo */}
        {!searchQuery.trim() && (
          <button
            onClick={() => setActiveChat("publico")}
            className={cn(
              "relative group p-[1px] rounded-2xl transition-all duration-300 text-left overflow-hidden",
              activeChat === "publico"
                ? "bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_18px_rgba(168,85,247,0.3)]"
                : "bg-slate-200 dark:bg-slate-800/60 hover:bg-gradient-to-r hover:from-cyan-500 hover:to-purple-500"
            )}
          >
            <div className="flex items-center gap-3 p-3.5 rounded-[15px] bg-white dark:bg-[#111625] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">Chat Público</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">Canal aberto para todos</p>
              </div>
              <UnreadBadge count={unreadPublic} />
            </div>
          </button>
        )}

        {/* Divisor Visual */}
        {!searchQuery.trim() && contacts.length > 0 && (
          <div className="flex items-center my-1 gap-3 px-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">PRIVADO</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-200 dark:from-slate-800 to-transparent" />
          </div>
        )}

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
          {isSearching && (
            <div className="text-center py-6 text-xs text-slate-400 animate-pulse">Buscando na rede...</div>
          )}

          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">Nenhum usuário encontrado</div>
          )}

          {!isSearching && displayList.map((c) => {
            const status = resolveStatus(c.id, onlineUsers);
            const isActive = activeChat === c.id;

            return (
              <button
                key={c.id}
                onClick={() => openContact(c)}
                className={cn(
                  "relative group p-[1px] rounded-2xl transition-all duration-300 text-left overflow-hidden",
                  isActive
                    ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-pink-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                    : "bg-slate-200 dark:bg-slate-800/40 hover:bg-gradient-to-r hover:from-cyan-500/50 hover:to-purple-500/50"
                )}
              >
                <div className="flex items-center gap-3 p-3.5 rounded-[15px] bg-white dark:bg-[#111625] transition-colors">
                  <div className="relative shrink-0">
                    <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size="md" />
                    <StatusDot status={status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{statusLabel(status)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center">
          Público: 24 h · Privado: 7 dias
        </p>
      </aside>

      {/* ÁREA PRINCIPAL DA CONVERSA */}
      <main className={cn(
        "flex-1 flex flex-col rounded-3xl bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-[0_0_30px_rgba(0,0,0,0.05)] dark:shadow-[0_0_35px_rgba(15,23,42,0.8)] overflow-hidden p-4 md:p-6 min-h-0 relative",
        showConversation ? "flex" : "hidden md:flex"
      )}>
        {/* Mobile Header Back Button */}
        {showConversation && (
          <div className="md:hidden flex items-center gap-2 pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveChat(null)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Voltar</span>
          </div>
        )}

        {activeChat === null ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 select-none">
            <div className="relative p-[2px] rounded-3xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
              <div className="w-16 h-16 rounded-[22px] bg-white dark:bg-[#0b0f17] flex items-center justify-center text-cyan-500 dark:text-cyan-400">
                <MessageCircle className="w-8 h-8" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-base">Selecione uma conversa</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Escolha o Chat Público ou um contato ao lado.</p>
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
      </main>

    </div>
  );
}