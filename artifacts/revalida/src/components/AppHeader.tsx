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
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between h-16 max-w-3xl mx-auto px-4">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout} 
            title="Sair" 
            className="h-9 w-9 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </Button>
          <StreakPill />
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold leading-none text-slate-900 dark:text-white">
              {user?.displayName || user?.name?.split(' ')[0]}
            </span>
            <span className="text-xs font-semibold leading-none text-cyan-600 dark:text-cyan-400 mt-1">
              {user?.role === 'admin' ? 'Administrador' : 'Estudante'}
            </span>
          </div>

          <Avatar className="h-9 w-9 border border-slate-200 dark:border-cyan-500/30 shadow-sm">
            {user?.avatarUrl && (
              <AvatarImage src={resolveImage(user.avatarUrl, "avatars")} alt={user.displayName || user.name} className="object-cover" />
            )}
            <AvatarFallback className="bg-cyan-600 text-white font-bold text-sm">
              {user ? formatInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme} 
            className="h-9 w-9 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
          </Button>
        </div>
      </div>
    </header>
  );
}