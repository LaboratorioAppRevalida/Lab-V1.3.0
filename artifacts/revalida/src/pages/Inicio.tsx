import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Stethoscope,
  BookOpen,
  NotebookPen,
  Trophy,
  Award,
  CalendarRange,
  Sparkles,
  LifeBuoy,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getLevelInfo } from "@/lib/levelSystem";
import { useEquippedTitle } from "@/hooks/useEquippedTitle";
import { TitleBadge } from "@/components/gamification/TitleBadge";
import { fetchUserAchievements } from "@/lib/achievementService";
import { getUserTitles } from "@/lib/titleService";

export default function Inicio() {
  const { user, profile, isAdmin, isColaborador } = useAuth();
  const [, setLocation] = useLocation();
  const { equippedTitle } = useEquippedTitle(user?.id);

  const [conquistas, setConquistas] = useState({ medals: 0, titles: 0, loaded: false });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([
      fetchUserAchievements(user.id).catch(() => [] as Awaited<ReturnType<typeof fetchUserAchievements>>),
      getUserTitles(user.id).catch(() => [] as Awaited<ReturnType<typeof getUserTitles>>),
    ]).then(([achs, titles]) => {
      if (cancelled) return;
      setConquistas({ medals: achs.length, titles: titles.length, loaded: true });
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const firstName =
    profile?.display_name ||
    profile?.name?.split(" ")[0] ||
    user?.displayName ||
    user?.name?.split(" ")[0] ||
    "Doutor";

  const xp = profile?.xp_total ?? 0;
  const info = useMemo(() => getLevelInfo(xp), [xp]);
  const streak = profile?.streak_atual ?? 0;

  const buttons = useMemo(() => {
    const grid = [
      { title: "Resumos",          icon: BookOpen,      subtitle: "Conteúdo essencial"  },
      { title: "Notas",            icon: NotebookPen,   subtitle: "Suas anotações"       },
      { title: "Rankings",         icon: Trophy,        subtitle: "Veja sua posição"     },
      { title: "Conquistas",       icon: Award,         subtitle: "Medalhas e marcos"    },
      { title: "Plano de estudos", icon: CalendarRange, subtitle: "Sua rotina"            },
      { title: "Assistente IA",    icon: Sparkles,      subtitle: "Tire dúvidas"         },
      { title: "Mentorias",        icon: Users,         subtitle: "Agende com especialistas" },
      { title: "Ajuda",            icon: LifeBuoy,      subtitle: "Suporte e FAQ"        },
    ];
    if (isAdmin) {
      grid.unshift({ title: "Painel Admin", icon: ShieldCheck, subtitle: "Gerenciar conteúdos" });
    }
    if (isColaborador) {
      grid.unshift({ title: "Colaborador", icon: Briefcase, subtitle: "Enviar estações" });
    }
    return grid;
  }, [isAdmin, isColaborador]);

  const handleCtaClick = () => setLocation("/treino");

  const handleGridClick = (title: string) => {
    switch (title) {
      case "Colaborador":       return setLocation("/colaborador");
      case "Painel Admin":      return setLocation("/admin");
      case "Resumos":           return setLocation("/resumos");
      case "Notas":             return setLocation("/notas");
      case "Plano de estudos":  return setLocation("/plano");
      case "Rankings":          return setLocation("/rankings");
      case "Conquistas":        return setLocation("/conquistas");
      case "Mentorias":         return setLocation("/mentorias");
      case "Ajuda":             return setLocation("/ajuda");
      default:                  return toast.info(`Em breve: ${title}`);
    }
  };

  // Classes compartilhadas do Liquid Glass Premium (Suave e com sensação de espessura de acrílico)
  const cardGlassClass = "relative overflow-hidden rounded-3xl p-5 flex border transition-all duration-300 backdrop-blur-xl bg-white/30 dark:bg-slate-900/30 border-white/60 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_12px_32px_-8px_rgba(4,24,36,0.08)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.15),0_20px_45px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),0_20px_40px_-10px_rgba(0,213,180,0.15)] dark:hover:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.25),0_0_25px_-5px_rgba(0,229,193,0.15),0_30px_60px_-15px_rgba(0,0,0,0.7)]";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* 1. Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2 pb-1"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Bem-vindo de volta, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-500 dark:from-cyan-400 dark:to-emerald-400">{firstName}</span>
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-slate-600 dark:text-cyan-200/60 font-medium text-sm">Pronto para evoluir hoje?</p>
          {equippedTitle && <TitleBadge title={equippedTitle} size="sm" />}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 2. Streak Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={cardGlassClass}
        >
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800/60 dark:text-cyan-200/40">
                Sequência diária
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black tabular-nums text-slate-900 dark:text-white">
                  {streak}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-cyan-200/50">
                  {streak === 1 ? "dia" : "dias"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-cyan-200/40 font-medium mt-0.5">
                {streak === 0 ? "Comece hoje sua sequência" : "Mantenha o ritmo amanhã!"}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shrink-0 text-white">
              <Zap className="h-5 w-5 fill-current" />
            </div>
          </div>
        </motion.div>

      {/* 3. Progress / Level Card — Com Barra de Brilho Vivo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className={cardGlassClass}
        >
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800/60 dark:text-cyan-200/40">
                  Progresso geral
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                  {info.name}
                </span>
              </div>
              <div className="shrink-0 px-2.5 py-0.5 rounded-full bg-teal-500/10 dark:bg-cyan-400/10 text-teal-700 dark:text-cyan-300 text-[11px] font-black border border-teal-500/20 dark:border-cyan-400/20 tabular-nums">
                Nível {info.level}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative h-2 w-full bg-slate-900/5 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${info.pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="relative h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400"
                >
                  {/* Efeito de Respiração Glow Fluida na Barra de XP */}
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                      boxShadow: [
                        "0 0 4px rgba(6,182,212,0.2)",
                        "0 0 12px rgba(6,182,212,0.6)",
                        "0 0 4px rgba(6,182,212,0.2)"
                      ]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-white/20 rounded-full"
                  />
                </motion.div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-cyan-200/40 font-semibold">
                <span className="tabular-nums">
                  {info.xpInCurrentLevel.toLocaleString("pt-BR")} / {info.xpForCurrentLevel.toLocaleString("pt-BR")} XP
                </span>
                <span className="tabular-nums text-right">
                  {info.xpRestante > 0
                    ? `${info.xpRestante.toLocaleString("pt-BR")} XP → Nível ${info.level + 1}`
                    : "Nível máximo!"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-900/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-cyan-200/40 font-medium">
                Total acumulado:
              </span>
              <span className="text-[11px] font-black tabular-nums text-teal-600 dark:text-cyan-400">
                {xp.toLocaleString("pt-BR")} XP
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. MAIN CTA — Cápsula de Vidro Líquido Premium com Efeito Vivo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        whileHover={{ scale: 1.02, translateY: -4 }}
        whileTap={{ scale: 0.98 }}
        className="cursor-pointer group"
        onClick={handleCtaClick}
      >
          <div className="relative min-h-[110px] rounded-3xl p-6 flex justify-between items-center overflow-hidden border backdrop-blur-2xl bg-gradient-to-br from-cyan-500/10 via-emerald-500/5 to-transparent border-cyan-500/20 dark:border-cyan-400/30 shadow-lg shadow-cyan-500/5">

          {/* Efeito Visual Ativo: Brilhos Animados (Sparkles) que piscam organicamente */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-3 right-12 text-cyan-400/40"
            >
              <Sparkles className="w-5 h-5" />
            </motion.div>
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.5,
              }}
              className="absolute bottom-4 left-1/3 text-emerald-400/30"
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>

            {/* Aura Radiante de Fundo (Glow Interno ao passar o mouse) */}
            <div className="absolute -inset-px bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
          </div>

          {/* Conteúdo do Card */}
          <div className="relative z-10 flex items-center gap-4">
            {/* Ícone com Pulso de Energia */}
            <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md shadow-cyan-500/20">
              <Stethoscope className="w-6 h-6 animate-pulse" strokeWidth={1.75} />
              <span className="absolute inset-0 rounded-2xl bg-cyan-500/30 animate-ping opacity-75" />
            </div>

            <div className="relative z-10 flex flex-col gap-0.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                Iniciar treino
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  ✨
                </motion.span>
              </h2>
              <p className="text-slate-600 dark:text-cyan-300/80 text-xs font-semibold">
                Simule estações da prova prática
              </p>
            </div>
          </div>

          {/* Seta Dinâmica de Ação Lateral */}
          <div className="relative z-10 p-2.5 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 group-hover:bg-cyan-500 group-hover:text-white group-hover:border-cyan-500 transition-all duration-300">
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>

        </div>
      </motion.div>

      {/* 5. GRID BUTTONS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
        {buttons.map((btn, i) => {
          const Icon = btn.icon;
          return (
            <motion.div
              key={btn.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.04 }}
              className={`${cardGlassClass} cursor-pointer group`}
              onClick={() => handleGridClick(btn.title)}
            >
              <div className="flex flex-col items-start gap-2.5 w-full">
                <div className="p-2 rounded-2xl bg-teal-500/5 dark:bg-cyan-500/5 border border-teal-500/10 dark:border-cyan-500/10 group-hover:bg-teal-500/10 dark:group-hover:bg-cyan-500/15 transition-colors">
                  <Icon
                    className="w-[18px] h-[18px] text-teal-600 dark:text-cyan-400 group-hover:scale-105 transition-transform"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-[14px]">
                    {btn.title}
                  </span>
                  {btn.title === "Conquistas" && conquistas.loaded ? (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap text-[10px] font-bold text-slate-500 dark:text-cyan-200/40">
                      <span>🏅 {conquistas.medals}/12</span>
                      <span className="text-slate-300 dark:text-cyan-400/20">·</span>
                      <span>🏆 {conquistas.titles}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/40 mt-0.5 leading-snug">
                      {btn.subtitle}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}