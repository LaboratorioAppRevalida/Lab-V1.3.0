import { Home, TrendingUp, Newspaper, User, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useChatUnread } from "@/contexts/ChatUnreadContext";

export function BottomNav() {
  const [location] = useLocation();
  const { totalUnread } = useChatUnread();

  const tabs = [
    { name: "Início",    path: "/inicio",    icon: Home,           badge: 0           },
    { name: "Chat",      path: "/chat",      icon: MessageSquare,  badge: totalUnread },
    { name: "Progresso", path: "/progresso", icon: TrendingUp,     badge: 0           },
    { name: "Notícias",  path: "/noticias",  icon: Newspaper,      badge: 0           },
    { name: "Perfil",    path: "/perfil",    icon: User,           badge: 0           },
  ];

  return (
    <nav className="fixed bottom-0 z-40 w-full backdrop-blur-xl bg-background/70 border-t border-cyan-400/20 shadow-[0_-1px_0_rgba(6,182,212,0.08)]">
      <div className="flex items-center justify-around h-[68px] max-w-3xl mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon     = tab.icon;
          const showBadge = tab.badge > 0 && !isActive;

          return (
            <Link key={tab.path} href={tab.path} className="flex-1">
              <div className="relative flex flex-col items-center justify-center h-full gap-1 cursor-pointer select-none group">

                {isActive && (
                  <div className="absolute top-0 w-8 h-[3px] rounded-b-md gradient-primary glow-primary" />
                )}

                {/* Icon + unread badge */}
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-all duration-300",
                      isActive
                        ? "text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                    strokeWidth={isActive ? 2 : 1.5}
                  />

                  {showBadge && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5",
                        "flex items-center justify-center rounded-full",
                        "text-[9px] font-bold text-white",
                        "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.9)]",
                        "animate-pulse"
                      )}
                    >
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive
                      ? "text-gradient-primary font-bold"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {tab.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
