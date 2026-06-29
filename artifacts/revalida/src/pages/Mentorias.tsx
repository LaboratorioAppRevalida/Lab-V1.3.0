import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Calendar, Star, X, ChevronRight, Clock, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listMentorsWithRatings,
  getMentorAvailability,
  listGroupMentorships,
  submitMentorReview,
  type MentorWithRating,
  type MentorshipSlot,
  type GroupMentorship,
} from "@/lib/mentorshipService";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "5511999999999";

function buildWaUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function StarDisplay({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
          />
        ))}
      </div>
      <span className="text-yellow-300 font-bold text-sm tabular-nums">
        {rating > 0 ? rating.toFixed(1) : "—"}
      </span>
      <span className="text-cyan-200/40 text-xs">({count} avaliações)</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Slot Modal ──────────────────────────────────────────────────────────────
function SlotModal({
  mentor,
  slots,
  loading,
  onClose,
}: {
  mentor: MentorWithRating;
  slots: MentorshipSlot[];
  loading: boolean;
  onClose: () => void;
}) {
  const displayName = mentor.display_name || mentor.name;

  function handleSlot(slot: MentorshipSlot) {
    const date = formatDate(slot.start_time);
    const time = formatTime(slot.start_time);
    const text = `Olá! Gostaria de agendar uma mentoria individual com o Dr. ${displayName} no dia ${date} às ${time}.`;
    window.open(buildWaUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-[#0a1628] border border-cyan-400/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular top line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Horários disponíveis</h3>
              <p className="text-cyan-300/60 text-sm mt-0.5">
                Dr. {displayName} · {mentor.mentor_specialty || "Especialista"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-cyan-200/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-10 h-10 text-cyan-400/20 mx-auto mb-3" />
              <p className="text-cyan-200/40 text-sm">Nenhum horário disponível no momento.</p>
              <p className="text-cyan-200/30 text-xs mt-1">Entre em contato pelo WhatsApp para mais opções.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => handleSlot(slot)}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-cyan-400/20 hover:border-cyan-400/50 bg-cyan-400/5 hover:bg-cyan-400/10 transition-all text-left"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-white font-semibold text-sm">
                      {formatDate(slot.start_time)}
                    </span>
                    <span className="text-cyan-300/60 text-xs">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                      Disponível
                    </span>
                    <ChevronRight className="w-4 h-4 text-cyan-400/40 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Mentor Card ─────────────────────────────────────────────────────────────
function MentorCard({
  mentor,
  onSelect,
}: {
  mentor: MentorWithRating;
  onSelect: (mentor: MentorWithRating) => void;
}) {
  const displayName = mentor.display_name || mentor.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative group cursor-pointer"
      onClick={() => onSelect(mentor)}
    >
      <div className="relative bg-[#0a1628] border border-cyan-400/20 hover:border-cyan-400/50 rounded-2xl p-5 transition-all hover:shadow-[0_0_24px_rgba(6,182,212,0.12)] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent group-hover:via-cyan-400/40 transition-all" />
        <div className="absolute top-[-60%] right-[-20%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.05)_0%,transparent_60%)] pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
            {mentor.mentor_avatar_url ? (
              <img
                src={mentor.mentor_avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCircle2 className="w-8 h-8 text-cyan-400/40" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base leading-tight truncate">
              Dr. {displayName}
            </h3>
            <p className="text-cyan-300/60 text-xs font-medium mt-0.5 truncate">
              {mentor.mentor_specialty || "Especialista em Revalidação"}
            </p>
            <div className="mt-2">
              <StarDisplay rating={mentor.avg_rating} count={mentor.review_count} />
            </div>
          </div>
        </div>

        {mentor.mentor_bio && (
          <p className="mt-3 text-cyan-200/50 text-sm leading-relaxed line-clamp-2">
            {mentor.mentor_bio}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-cyan-200/30 font-medium">Ver horários disponíveis</span>
          <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold group-hover:gap-2.5 transition-all">
            <Calendar className="w-3.5 h-3.5" />
            <span>Agendar</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ session }: { session: GroupMentorship }) {
  const mentorName = session.mentor.display_name || session.mentor.name;
  const pct = Math.min(100, (session.current_bookings / session.max_capacity) * 100);
  const vagas = session.max_capacity - session.current_bookings;
  const isFull = vagas <= 0;

  function handleBook() {
    if (isFull) return;
    const text = `Olá! Quero garantir minha vaga na Mentoria em Grupo: ${session.title} com o Dr. ${mentorName}.`;
    window.open(buildWaUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative bg-[#0a1628] border border-cyan-400/20 rounded-2xl p-5 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">{session.title}</h3>
          <p className="text-cyan-300/60 text-xs font-medium mt-0.5">Dr. {mentorName}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            {formatDate(session.start_time)}
          </span>
          <span className="text-[11px] text-cyan-200/40 font-medium">
            {formatTime(session.start_time)} – {formatTime(session.end_time)}
          </span>
        </div>
      </div>

      {session.description && (
        <p className="mt-3 text-cyan-200/50 text-sm leading-relaxed line-clamp-2">
          {session.description}
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-cyan-200/50 font-medium">Vagas</span>
          <span className={`font-bold tabular-nums ${isFull ? "text-red-400" : "text-cyan-300"}`}>
            {session.current_bookings} / {session.max_capacity}
          </span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-cyan-500"}`}
          />
        </div>
      </div>

      <button
        onClick={handleBook}
        disabled={isFull}
        className={`mt-4 w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
          ${isFull
            ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/10"
            : "bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 hover:from-cyan-500/30 hover:to-cyan-400/20 text-cyan-300 border border-cyan-400/30 hover:border-cyan-400/60 hover:shadow-[0_0_16px_rgba(6,182,212,0.15)]"
          }`}
      >
        {isFull ? "Turma lotada" : (
          <>
            <Users className="w-4 h-4" />
            Garantir Vaga
          </>
        )}
      </button>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Mentorias() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"individual" | "group">("individual");

  const [mentors, setMentors] = useState<MentorWithRating[]>([]);
  const [groupSessions, setGroupSessions] = useState<GroupMentorship[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [selectedMentor, setSelectedMentor] = useState<MentorWithRating | null>(null);
  const [slots, setSlots] = useState<MentorshipSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    setLoadingMentors(true);
    listMentorsWithRatings()
      .then(setMentors)
      .catch(() => toast.error("Erro ao carregar mentores"))
      .finally(() => setLoadingMentors(false));

    setLoadingGroups(true);
    listGroupMentorships()
      .then(setGroupSessions)
      .catch(() => toast.error("Erro ao carregar mentorias em grupo"))
      .finally(() => setLoadingGroups(false));
  }, []);

  function handleSelectMentor(mentor: MentorWithRating) {
    setSelectedMentor(mentor);
    setSlots([]);
    setLoadingSlots(true);
    getMentorAvailability(mentor.id)
      .then(setSlots)
      .catch(() => toast.error("Erro ao buscar horários"))
      .finally(() => setLoadingSlots(false));
  }

  const tabs = [
    { key: "individual" as const, label: "Individual", icon: Calendar },
    { key: "group" as const, label: "Em Grupo", icon: Users },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2"
      >
        <h1 className="text-3xl font-bold tracking-tight text-white">Mentorias</h1>
        <p className="text-cyan-200/50 font-medium mt-1 text-sm">
          Aprenda com quem já passou pela prova. Agende sua sessão com um especialista.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-2 p-1 bg-white/5 border border-cyan-400/15 rounded-xl w-fit"
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                : "text-cyan-200/40 hover:text-cyan-200/70"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "individual" && (
          <motion.div
            key="individual"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.25 }}
          >
            {loadingMentors ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : mentors.length === 0 ? (
              <div className="text-center py-20">
                <UserCircle2 className="w-14 h-14 text-cyan-400/20 mx-auto mb-4" />
                <p className="text-cyan-200/40 font-medium">Nenhum mentor disponível no momento.</p>
                <p className="text-cyan-200/25 text-sm mt-1">Volte em breve — novos mentores serão adicionados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mentors.map((mentor) => (
                  <MentorCard key={mentor.id} mentor={mentor} onSelect={handleSelectMentor} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "group" && (
          <motion.div
            key="group"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
          >
            {loadingGroups ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : groupSessions.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-14 h-14 text-cyan-400/20 mx-auto mb-4" />
                <p className="text-cyan-200/40 font-medium">Nenhuma mentoria em grupo agendada.</p>
                <p className="text-cyan-200/25 text-sm mt-1">Fique de olho — novas turmas serão abertas em breve.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupSessions.map((session) => (
                  <GroupCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slot Modal */}
      <AnimatePresence>
        {selectedMentor && (
          <SlotModal
            mentor={selectedMentor}
            slots={slots}
            loading={loadingSlots}
            onClose={() => setSelectedMentor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
