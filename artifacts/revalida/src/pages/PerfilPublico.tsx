import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, Zap, Flame, BookOpen, Trophy, MapPin, Loader2, UserCircle, MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/users/UserAvatar";
import { motion } from "framer-motion";
import { fetchPublicProfile, type PublicProfile } from "@/lib/profileService";
import { supabase } from "@/lib/supabase";
import { getLevelInfo } from "@/lib/levelSystem";
import { getEquippedTitle, type DbTitle } from "@/lib/titleService";
import { TitleBadge } from "@/components/gamification/TitleBadge";
import { fetchUserAchievements, type DbAchievement, type DbUserAchievement } from "@/lib/achievementService";
import { AchievementBadge, type AchievementBadgeData } from "@/components/gamification/AchievementBadge";

// ── Dados extras (sessões + posição no ranking) ──────────────────────────────

type ExtraData = {
  sessionCount: number;
  rankingPosition: number | null;
};

async function fetchExtra(userId: string): Promise<ExtraData> {
  const [sessionsResult, rankingResult] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("id, xp_total")
      .order("xp_total", { ascending: false }),
  ]);

  const sessionCount = sessionsResult.count ?? 0;

  let rankingPosition: number | null = null;
  if (rankingResult.data) {
    const idx = (rankingResult.data as { id: string }[]).findIndex((p) => p.id === userId);
    if (idx !== -1) rankingPosition = idx + 1;
  }

  return { sessionCount, rankingPosition };
}

// ── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "blue" | "amber" | "emerald" | "violet" | "rose";
}) {
  const tones = {
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  };
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-4 text-center shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </div>
      <div className="text-xl font-extrabold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

export default function PerfilPublico() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [, setLocation] = useLocation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [extra, setExtra] = useState<ExtraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [equippedTitle, setEquippedTitle] = useState<DbTitle | null>(null);
  const [userAchs, setUserAchs]           = useState<(DbUserAchievement & { achievement: DbAchievement })[]>([]);

  useEffect(() => {
    if (!userId) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    setNotFound(false);

    Promise.all([
      fetchPublicProfile(userId),
      fetchExtra(userId),
      getEquippedTitle(userId).catch(() => null),
      fetchUserAchievements(userId).catch(() => [] as (DbUserAchievement & { achievement: DbAchievement })[]),
    ]).then(([prof, ext, title, achs]) => {
      if (!prof) { setNotFound(true); }
      else { setProfile(prof); setExtra(ext); setEquippedTitle(title); setUserAchs(achs); }
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background px-4">
        <UserCircle className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">Perfil não encontrado</h2>
        <p className="text-sm text-muted-foreground text-center">
          Este usuário não existe ou o perfil é privado.
        </p>
        <button
          onClick={() => setLocation("/treino")}
          className="text-sm text-primary hover:underline"
        >
          ← Voltar à lista
        </button>
      </div>
    );
  }

  const displayName = profile.display_name?.trim() || profile.name?.trim() || "Usuário";
  const levelInfo = getLevelInfo(profile.xp_total ?? 0);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/treino")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold truncate flex-1">Perfil do colega</span>
          {userId && (
            <button
              onClick={() => {
                sessionStorage.setItem("chat_open_with", userId);
                setLocation("/chat");
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-primary"
              aria-label="Enviar mensagem privada"
              title="Mensagem privada"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* IDENTITY CARD */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-md p-6 flex items-center gap-5 shadow-sm"
        >
          <UserAvatar name={displayName} avatarUrl={profile.avatar_url} size="xl" />

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate">{displayName}</h1>

            {equippedTitle && (
              <div className="mt-1">
                <TitleBadge title={equippedTitle} size="sm" />
              </div>
            )}

            {(profile.city_uf || profile.country) && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {[profile.city_uf, profile.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}


            {/* XP progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="font-semibold text-foreground">Nível {levelInfo.level}</span>
                <span className="tabular-nums">{profile.xp_total ?? 0} XP</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
                  style={{ width: `${Math.min(100, levelInfo.pct)}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* STATS GRID */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Nível"
            value={levelInfo.level}
            tone="violet"
          />
          <StatCard
            icon={<Flame className="w-5 h-5" />}
            label="Sequência"
            value={`${profile.streak_atual ?? 0}🔥`}
            tone="amber"
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5" />}
            label="Estações"
            value={extra?.sessionCount ?? 0}
            tone="blue"
          />
          <StatCard
            icon={<Trophy className="w-5 h-5" />}
            label="Ranking"
            value={extra?.rankingPosition != null ? `#${extra.rankingPosition}` : "—"}
            tone="emerald"
          />
        </motion.div>

        {/* MEDALHAS */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 flex flex-col gap-3 shadow-sm"
        >
          <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Medalhas
          </h2>
          {userAchs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
              <span className="text-3xl">🏅</span>
              <p className="text-sm font-medium">Nenhuma medalha desbloqueada ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {userAchs.slice(0, 12).map((ua) => {
                const ach = ua.achievement;
                const data: AchievementBadgeData = {
                  id:          ach.id,
                  slug:        ach.slug,
                  title:       ach.title,
                  description: ach.description,
                  tier:        ach.tier as AchievementBadgeData["tier"],
                  icon:        ach.icon,
                  color:       ach.color,
                };
                return (
                  <AchievementBadge key={ach.slug} achievement={data} unlocked />
                );
              })}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
