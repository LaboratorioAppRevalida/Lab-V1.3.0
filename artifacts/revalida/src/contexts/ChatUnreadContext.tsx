import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface ChatUnreadContextType {
  unreadPublic:  number;
  unreadPrivate: number;
  totalUnread:   number;
  resetPublic:   () => void;
  resetPrivate:  () => void;
}

const ChatUnreadCtx = createContext<ChatUnreadContextType>({
  unreadPublic:  0,
  unreadPrivate: 0,
  totalUnread:   0,
  resetPublic:   () => void 0,
  resetPrivate:  () => void 0,
});

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadPublic,  setUnreadPublic]  = useState(0);
  const [unreadPrivate, setUnreadPrivate] = useState(0);

  // Track mount timestamp so we ignore historical rows on first load
  const mountedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (!user) return;
    mountedAtRef.current = new Date().toISOString();

    // ── Public messages channel ──────────────────────────────────────────
    const pubCh = supabase
      .channel("chat_unread_public")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; created_at: string };
          if (row.sender_id === user.id) return;          // own message
          if (row.created_at < mountedAtRef.current) return; // stale
          setUnreadPublic((n) => n + 1);
        }
      )
      .subscribe();

    // ── Private messages channel ─────────────────────────────────────────
    const privCh = supabase
      .channel("chat_unread_private")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "private_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { created_at: string };
          if (row.created_at < mountedAtRef.current) return;
          setUnreadPrivate((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pubCh);
      supabase.removeChannel(privCh);
    };
  }, [user]);

  const value: ChatUnreadContextType = {
    unreadPublic,
    unreadPrivate,
    totalUnread:  unreadPublic + unreadPrivate,
    resetPublic:  () => setUnreadPublic(0),
    resetPrivate: () => setUnreadPrivate(0),
  };

  return <ChatUnreadCtx.Provider value={value}>{children}</ChatUnreadCtx.Provider>;
}

export function useChatUnread(): ChatUnreadContextType {
  return useContext(ChatUnreadCtx);
}
