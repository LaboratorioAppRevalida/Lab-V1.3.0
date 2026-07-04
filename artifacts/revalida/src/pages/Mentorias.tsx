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
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${
              s <= Math.round(rating)
                ? "text-amber-500 fill-amber-500"
                : "text-slate-300 dark:text-white/20"
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-cyan-200/50">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export default function MentoriasPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"individual" | "grupo">("individual");

  const [mentors, setMentors] = useState<MentorWithRating[]>([]);
  const [groupSessions, setGroupSessions] = useState<GroupMentorship[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Modal para mentoria individual
  const [selectedMentor, setSelectedMentor] = useState<MentorWithRating | null>(null);
  const [slots, setSlots] = useState<MentorshipSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Modal para Avaliação (Review)
  const [reviewMentor, setReviewMentor] = useState<MentorWithRating | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadMentors();
  }, []);

  useEffect(() => {
    if (activeTab === "grupo") {
      loadGroups();
    }
  }, [activeTab]);

  async function loadMentors() {
    try {
      setLoadingMentors(true);
      const data = await listMentorsWithRatings();
      setMentors(data);
    } catch (err: any) {
      toast.error("Erro ao carregar mentores.");
    } finally {
      setLoadingMentors(false);
    }
  }

  async function loadGroups() {
    try {
      setLoadingGroups(true);
      const data = await listGroupMentorships();
      setGroupSessions(data);
    } catch (err: any) {
      toast.error("Erro ao carregar mentorias em grupo.");
    } finally {
      setLoadingGroups(false);
    }
  }

  async function handleOpenIndividualModal(mentor: MentorWithRating) {
    setSelectedMentor(mentor);
    setLoadingSlots(true);
    setSlots([]);
    try {
      const availableSlots = await getMentorAvailability(mentor.id);
      setSlots(availableSlots);
    } catch (err: any) {
      toast.error("Não foi possível carregar os horários deste mentor.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleAgendarIndividual(slot: MentorshipSlot) {
    if (!selectedMentor) return;
    const msg = `Olá! Sou o aluno ${user?.name || ""} e gostaria de agendar a mentoria individual com o mentor ${selectedMentor.name} no horário de ${new Date(slot.start_time).toLocaleString("pt-BR")}.`;
    window.open(buildWaUrl(msg), "_blank");
  }

  function handleAgendarGrupo(session: GroupMentorship) {
    const msg = `Olá! Sou o aluno ${user?.name || ""} e quero participar da mentoria em grupo "${session.title}" agendada para ${new Date(session.scheduled_to).toLocaleString("pt-BR")}.`;
    window.open(buildWaUrl(msg), "_blank");
  }

  async function handleSubmitReview() {
    if (!reviewMentor || !user) return;
    try {
      setSubmittingReview(true);
      await submitMentorReview({
        mentor_id: reviewMentor.id,
        student_id: user.id,
        rating,
        comment: comment.trim(),
      });
      toast.success("Avaliação enviada com sucesso!");
      setReviewMentor(null);
      setComment("");
      setRating(5);
      void loadMentors();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar avaliação.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 min-h-screen">
      {/* Cabeçalho */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-cyan-300 bg-clip-text text-transparent">
          Mentorias Especializadas
        </h1>
        <p className="text-sm text-slate-600 dark:text-cyan-200/40">
          Agende sessões estratégicas individuais ou participe de encontros coletivos focados na sua aprovação.
        </p>
      </div>

      {/* Tabs Customizadas Premium */}
      <div className="flex p-1 max-w-md bg-slate-200/60 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-slate-300/30 dark:border-white/5">
        <button
          onClick={() => setActiveTab("individual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "individual"
              ? "bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500/80 dark:to-blue-500/80 text-white shadow-md shadow-blue-500/10"
              : "text-slate-600 dark:text-cyan-200/50 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <UserCircle2 className="w-4 h-4" />
          Individual
        </button>
        <button
          onClick={() => setActiveTab("grupo")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "grupo"
              ? "bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500/80 dark:to-blue-500/80 text-white shadow-md shadow-blue-500/10"
              : "text-slate-600 dark:text-cyan-200/50 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Em Grupo
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <AnimatePresence mode="wait">
        {activeTab === "individual" ? (
          <motion.div
            key="individual"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {loadingMentors ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : mentors.length === 0 ? (
              <div className="text-center py-20 bg-white/40 dark:bg-slate-900/10 rounded-3xl border border-slate-200 dark:border-white/5">
                <UserCircle2 className="w-14 h-14 text-slate-300 dark:text-cyan-400/20 mx-auto mb-4" />
                <p className="text-slate-800 dark:text-cyan-200/40 font-medium">Nenhum mentor disponível no momento.</p>
              </div>
            ) : (
              /* Alterado para máximo 2 colunas para expandir horizontalmente */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mentors.map((mentor) => (
                  <div
                    key={mentor.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/30 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group min-h-[180px]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-4">
                        {mentor.avatar_url ? (
                          <img
                            src={mentor.avatar_url}
                            alt={mentor.name}
                            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-white/5"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                            <UserCircle2 className="w-8 h-8" />
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate">{mentor.name}</h3>
                          <div className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/10 uppercase tracking-wide truncate max-w-full">
                            {mentor.specialties || "Mentor Geral"}
                          </div>
                          <StarDisplay rating={mentor.avg_rating} count={mentor.review_count} />
                        </div>
                      </div>

                      {mentor.bio && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed pt-1">
                          {mentor.bio}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenIndividualModal(mentor)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white text-sm font-bold transition-all"
                      >
                        <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        Ver Agenda
                      </button>
                      <button
                        onClick={() => setReviewMentor(mentor)}
                        className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-cyan-200/50 hover:text-slate-800 dark:hover:text-white transition-all text-xs font-bold"
                        title="Avaliar Mentor"
                      >
                        Avaliar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="grupo"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {loadingGroups ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : groupSessions.length === 0 ? (
              <div className="text-center py-20 bg-white/40 dark:bg-slate-900/10 rounded-3xl border border-slate-200 dark:border-white/5">
                <Users className="w-14 h-14 text-slate-300 dark:text-cyan-400/20 mx-auto mb-4" />
                <p className="text-slate-800 dark:text-cyan-200/40 font-medium">Nenhuma mentoria em grupo agendada.</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fique de olho — novas turmas serão abertas em breve.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/30 backdrop-blur-md p-6 shadow-sm relative overflow-hidden min-h-[180px]"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/10 shrink-0">
                          Mentoria Coletiva
                        </span>
                        <div className="flex items-center gap-2 ml-auto">
                          {/* Occupancy badge */}
                          {(() => {
                            const remaining = session.max_capacity - session.current_bookings;
                            const isFull    = remaining <= 0;
                            const isLow     = !isFull && remaining <= 3;
                            return (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                                isFull
                                  ? "bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border-red-200 dark:border-red-400/20"
                                  : isLow
                                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-400/20"
                                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/20"
                              }`}>
                                <Users className="w-3 h-3 shrink-0" />
                                {isFull ? "Esgotado" : `${remaining} vaga${remaining === 1 ? "" : "s"}`}
                              </span>
                            );
                          })()}
                          {/* Duration */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-cyan-200/40">
                            <Clock className="w-3.5 h-3.5" />
                            {Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000)} min
                          </div>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-snug">{session.title}</h3>
                      {session.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                          {session.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 dark:text-cyan-200/30 uppercase tracking-wider">Agendado para</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {new Date(session.start_time).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      {session.current_bookings >= session.max_capacity ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-cyan-200/25 text-sm font-bold cursor-not-allowed shrink-0 border border-slate-200 dark:border-white/5"
                        >
                          <Users className="w-4 h-4" /> Esgotado
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAgendarGrupo(session)}
                          className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500/80 dark:to-blue-500/80 text-white text-sm font-bold shadow-sm hover:opacity-95 transition-all shrink-0"
                        >
                          Garantir Vaga <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE SLOTS DA AGENDA ── */}
      <AnimatePresence>
        {selectedMentor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMentor(null)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl z-10 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Horários Disponíveis</h3>
                  <p className="text-xs text-slate-500 dark:text-cyan-200/40 mt-0.5">Mentor: {selectedMentor.name}</p>
                </div>
                <button
                  onClick={() => setSelectedMentor(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-2.5 min-h-[150px] scrollbar-thin">
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 dark:text-cyan-200/30">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-white/10 mb-2" />
                    <p className="text-sm font-medium">Nenhum horário livre esta semana.</p>
                  </div>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {new Date(slot.start_time).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} - {" "}
                        <span className="font-bold text-slate-900 dark:text-white">
                          {new Date(slot.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAgendarIndividual(slot)}
                        className="h-8 px-3 rounded-lg bg-cyan-600 dark:bg-cyan-500/20 text-white dark:text-cyan-400 hover:bg-cyan-700 dark:hover:bg-cyan-500/30 text-xs font-bold transition-all"
                      >
                        Agendar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL PARA AVALIAÇÃO DE MENTOR ── */}
      <AnimatePresence>
        {reviewMentor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewMentor(null)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Avaliar Mentor</h3>
                <button
                  onClick={() => setReviewMentor(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Como foi sua experiência de mentoria com <span className="font-bold text-slate-900 dark:text-white">{reviewMentor.name}</span>?
                </p>

                {/* Seletor de Estrelas */}
                <div className="flex items-center gap-1.5 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= rating ? "text-amber-500 fill-amber-500" : "text-slate-200 dark:text-white/10"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-cyan-200/40 uppercase tracking-wider">Comentário (opcional)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Deixe um depoimento sobre a didática e o direcionamento recebido..."
                    rows={3}
                    className="w-full text-sm rounded-2xl p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2 justify-end">
                <button
                  onClick={() => setReviewMentor(null)}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSubmitReview()}
                  disabled={submittingReview}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500/80 dark:to-blue-500/80 text-white text-sm font-bold shadow-sm hover:opacity-95 transition-all flex items-center justify-center"
                >
                  {submittingReview ? "Enviando..." : "Enviar Avaliação"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}