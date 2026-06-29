import { useEffect, useState } from "react";
import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPublico } from "./ChatPublico";
import { ChatPrivado } from "./ChatPrivado";
import { useChatUnread } from "@/contexts/ChatUnreadContext";

type Tab = "publico" | "privado";

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-violet-500 text-white shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AbaChatContainer() {
  const [tab, setTab] = useState<Tab>(() =>
    sessionStorage.getItem("chat_open_with") ? "privado" : "publico"
  );
  const { unreadPublic, unreadPrivate, resetPublic, resetPrivate } = useChatUnread();

  // Reset unread count when switching to a tab
  useEffect(() => {
    if (tab === "publico")  resetPublic();
    if (tab === "privado") resetPrivate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs = [
    { id: "publico"  as const, label: "Chat Público",  Icon: Globe, unread: unreadPublic  },
    { id: "privado" as const,  label: "Chat Privado",  Icon: Lock,  unread: unreadPrivate },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-68px-64px)] min-h-0">

      {/* ── Glass pill tab switcher ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 mb-3 shrink-0
                      bg-black/10 dark:bg-black/30 backdrop-blur-md
                      border border-white/10 rounded-2xl shadow-inner">
        {tabs.map(({ id, label, Icon, unread }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold",
                "transition-all duration-300 select-none",
                active
                  ? "bg-gradient-to-r from-violet-600/80 to-indigo-600/80 text-white shadow-[0_0_16px_rgba(139,92,246,0.5)] border border-violet-400/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active && "drop-shadow-[0_0_6px_rgba(192,132,252,0.9)]")} />
              <span className="truncate">{label}</span>
              <UnreadBadge count={unread} />
            </button>
          );
        })}
      </div>

      {/* ── Notice ──────────────────────────────────────────────────────── */}
      <p className="text-[10px] text-muted-foreground/70 text-center mb-2 shrink-0 px-2">
        O histórico do Chat Público é limpo a cada 24 h · o do Chat Privado a cada 7 dias
      </p>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden
                      bg-black/5 dark:bg-black/20 backdrop-blur-md
                      border border-white/10 shadow-2xl">
        {tab === "publico"  && <ChatPublico />}
        {tab === "privado" && <ChatPrivado />}
      </div>
    </div>
  );
}
