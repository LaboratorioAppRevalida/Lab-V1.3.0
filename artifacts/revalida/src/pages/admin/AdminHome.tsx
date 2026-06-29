import { motion } from "framer-motion";
import { ClipboardList, BookOpen, Newspaper, Settings, Activity, ArrowRight, Users, Medal, Palette, Gem, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function AdminHome() {
  const [, setLocation] = useLocation();

  const cards = [
    {
      title: "Checklists",
      subtitle: "Gerencie estações da prova prática",
      icon: ClipboardList,
      bgClass: "bg-blue-500",
      iconColor: "text-blue-500 dark:text-blue-400",
      action: () => setLocation("/admin/checklists"),
    },
    {
      title: "Resumos",
      subtitle: "Conteúdo de estudo",
      icon: BookOpen,
      bgClass: "bg-cyan-500",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      action: () => setLocation("/admin/resumos"),
    },
    {
      title: "Notícias",
      subtitle: "Avisos e atualizações",
      icon: Newspaper,
      bgClass: "bg-violet-500",
      iconColor: "text-violet-500 dark:text-violet-400",
      action: () => setLocation("/admin/noticias"),
    },
    {
      title: "Observabilidade",
      subtitle: "Métricas, eventos e feedback",
      icon: Activity,
      bgClass: "bg-emerald-500",
      iconColor: "text-emerald-500 dark:text-emerald-400",
      action: () => setLocation("/admin/observabilidade"),
    },
    {
      title: "Gerenciar usuários",
      subtitle: "Perfis, suspensões e advertências",
      icon: Users,
      bgClass: "bg-orange-500",
      iconColor: "text-orange-500 dark:text-orange-400",
      action: () => setLocation("/admin/usuarios"),
    },
    {
      title: "Gamificação",
      subtitle: "Missões, níveis, títulos e eventos",
      icon: Medal,
      bgClass: "bg-rose-500",
      iconColor: "text-rose-500 dark:text-rose-400",
      action: () => setLocation("/admin/gamificacao"),
    },
    {
      title: "Configurações",
      subtitle: "Preferências da plataforma",
      icon: Settings,
      bgClass: "bg-slate-500",
      iconColor: "text-slate-500 dark:text-slate-400",
      action: () => setLocation("/admin/configuracoes"),
    },
    {
      title: "Personalização",
      subtitle: "Customização de cores, temas e imagens de fundo",
      icon: Palette,
      bgClass: "bg-cyan-400",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      action: () => setLocation("/admin/personalizacao"),
    },
    {
      title: "Gerenciar Assinaturas",
      subtitle: "Atribuir, editar e revogar planos de usuários",
      icon: Gem,
      bgClass: "bg-amber-400",
      iconColor: "text-amber-500 dark:text-amber-400",
      action: () => setLocation("/admin/assinaturas"),
    },
    {
      title: "Mentorias",
      subtitle: "Promover mentores e publicar horários",
      icon: CalendarRange,
      bgClass: "bg-teal-400",
      iconColor: "text-teal-500 dark:text-teal-400",
      action: () => setLocation("/admin/mentorias"),
    },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full px-1">
      {/* Cabeçalho do Painel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pt-2 pb-1"
      >
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Painel administrativo
        </h1>
        <p className="text-sm font-medium text-slate-600 dark:text-cyan-200/60 mt-0.5">
          Gerencie o conteúdo da plataforma Revalida
        </p>
      </motion.div>

      {/* Grid de Módulos Ajustado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 items-stretch">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="h-full"
            >
              <Card
                className="relative overflow-hidden rounded-3xl p-5 md:p-6 flex flex-col items-start gap-3 border transition-all duration-300 backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 border-white/60 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_12px_32px_-8px_rgba(4,24,36,0.04)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.15),0_20px_45px_-12px_rgba(0,0,0,0.4)] hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-slate-900/60 hover:shadow-[0_20px_40px_-10px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer group h-full justify-between"
                onClick={card.action}
              >
                {/* Linha Fina Viva na borda superior */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] ${card.bgClass} opacity-85 group-hover:opacity-100 transition-opacity`} />

                {/* Conteúdo Superior */}
                <div className="w-full flex flex-col gap-3">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                        <Icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={2} />
                      </div>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                        {card.title}
                      </h2>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-cyan-200/30 group-hover:text-slate-700 dark:group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                  </div>

                  {/* Subtítulo */}
                  <p className="text-sm font-medium text-slate-600 dark:text-cyan-200/50 leading-relaxed max-w-[95%]">
                    {card.subtitle}
                  </p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}