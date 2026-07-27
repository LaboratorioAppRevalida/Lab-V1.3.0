import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { resolveImage } from "@/lib/storageService";
import { formatInitials } from "@/lib/format";
import { StreakPill } from "./StreakPill";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    await logout();
    toast.info("Você saiu da sua conta");
    setLocation("/login");
  };

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/70 border-b border-cyan-400/20 shadow-[0_1px_0_rgba(6,182,212,0.08)]">
      <div className="flex items-center justify-between h-16 max-w-3xl mx-auto px-4">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
            <LogOut className="h-5 w-5" />
          </Button>
          <StreakPill />
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-semibold leading-none text-white">{user?.displayName || user?.name.split(' ')[0]}</span>
            <span className="text-xs text-cyan-300/60 leading-none mt-1">{user?.role === 'admin' ? 'Administrador' : 'Estudante'}</span>
          </div>
          
          <Avatar className="h-9 w-9 border border-cyan-400/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            {user?.avatarUrl && (
              <AvatarImage src={resolveImage(user.avatarUrl, "avatars")} alt={user.displayName || user.name} className="object-cover" />
            )}
            <AvatarFallback className="gradient-primary text-white font-bold text-sm">
              {user ? formatInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
