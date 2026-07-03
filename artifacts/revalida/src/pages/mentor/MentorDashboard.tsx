import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck, Calendar, Users, Save, Plus, Trash2,
  Loader2, Clock, X, Check, ChevronRight, BookOpen, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateMentorProfile,
  createIndividualSlot,
  createGroupMentorship,
  deleteIndividualSlot,
  deleteGroupMentorship,
  type MentorshipSlot,
  type GroupMentorship,
} from "@/lib/mentorshipService";
import { supabase } from "@/lib/supabase";

// ── Shared styles ────────────────────────────────────────────────────────────

const cardCls =
  "rounded-3xl border border-slate-200 dark:border-white/5 " +
  "bg-white dark:bg-slate-900/30 backdrop-blur-md " +
  "shadow-sm dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]";

const inputCls =
  "w-full rounded-xl px-3.5 py-2.5 text-sm " +
  "bg-slate-50 dark:bg-white/5 " +
  "border border-slate-200 dark:border-white/10 " +
  "text-slate-900 dark:text-white " +
  "placeholder:text-slate-400 dark:placeholder:text-cyan-200/25 " +
  "focus:outline-none focus:border-cyan-500/60 dark:focus:border-cyan-400/50 " +
  "transition-colors";

const labelCls =
  "block text-xs font-bold uppercase tracking-wider " +
  "text-slate-500 dark:text-cyan-200/40 mb-1.5";

const btnPrimaryCls =
  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold " +
  "bg-gradient-to-r from-cyan-600 to-blue-600 text-white " +
  "shadow-md shadow-cyan-500/20 " +
  "hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] " +
  "active:scale-[0.98] transition-all duration-200 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100";

const btnSecCls =
  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold " +
  "bg-slate-100 dark:bg-white/5 " +
  "border border-slate-200 dark:border-white/10 " +
  "text-slate-700 dark:text-cyan-200/70 " +
  "hover:bg-slate-200 dark:hover:bg-white/10 " +
  "transition-all duration-200";

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <Loader2
      className={`animate-spin ${sm ? "w-3.5 h-3.5" : "w-4 h-4"}`}
    />
  );
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── TAB 1: Meu Perfil ────────────────────────────────────────────────────────

function TabPerfil({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const [specialty, setSpecialty] = useState(profile?.mentor_specialty ?? "");
  const [bio, setBio]             = useState(profile?.mentor_bio ?? "");
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateMentorProfile(userId, {
        mentor_specialty: specialty.trim() || null,
        mentor_bio:       bio.trim() || null,
      });
      toast.success("Perfil atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`${cardCls} p-6`}>
        <h3 className="font-bold text-slate-900 dark:text-white text-base mb-5 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-500" />
          Informações do Mentor
        </h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Especialidade</label>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex: Clínica Médica, Cirurgia, Pediatria…"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Biografia do Mentor</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Descreva sua experiência, formação e como você pode ajudar os alunos…"
              rows={5}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className={btnPrimaryCls}
            >
              {saving ? <Spinner sm /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando…" : "Salvar Perfil"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 2: Minha Agenda ──────────────────────────────────────────────────────

function AddSlotModal({
  userId,
  onClose,
  onCreated,
}: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime]     = useState("");
  const [saving, setSaving]       = useState(false);

  async function handleCreate() {
    if (!startTime || !endTime) { toast.error("Preencha início e fim."); return; }
    if (new Date(startTime) >= new Date(endTime)) { toast.error("O início deve ser antes do fim."); return; }
    setSaving(true);
    try {
      await createIndividualSlot(userId, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      toast.success("Horário criado!");
      onCreated();
      onClose();
    } catch {
      toast.error("Erro ao criar horário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`${cardCls} p-6 w-full max-w-sm`}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 dark:text-white">Adicionar Horário</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-500 dark:text-cyan-200/50" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Início</label>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fim</label>
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`${btnSecCls} flex-1 justify-center`}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={`${btnPrimaryCls} flex-1 justify-center`}>
              {saving ? <Spinner sm /> : <Check className="w-4 h-4" />}
              {saving ? "Criando…" : "Criar Horário"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TabAgenda({ userId }: { userId: string }) {
  const [slots, setSlots]           = useState<MentorshipSlot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mentorship_slots")
        .select("id, mentor_id, start_time, end_time, status")
        .eq("mentor_id", userId)
        .order("start_time", { ascending: true });
      if (error) throw error;
      setSlots((data ?? []) as MentorshipSlot[]);
    } catch {
      toast.error("Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void fetchSlots(); }, [fetchSlots]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteIndividualSlot(id);
      setSlots((prev) => prev.filter((s) => s.id !== id));
      toast.success("Horário removido.");
    } catch {
      toast.error("Erro ao remover horário.");
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  const available = slots.filter((s) => s.status === "available");
  const booked    = slots.filter((s) => s.status === "booked");

  function SlotCard({ slot }: { slot: MentorshipSlot }) {
    const isAvail = slot.status === "available";
    const isConfirming = confirmId === slot.id;
    const isDel = deleting === slot.id;
    return (
      <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border ${isAvail ? "border-emerald-200 dark:border-emerald-400/20 bg-emerald-50 dark:bg-emerald-400/5" : "border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3"}`}>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`text-xs font-bold uppercase tracking-wide ${isAvail ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-cyan-200/50"}`}>
            {isAvail ? "Disponível" : "Reservado"}
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {formatDT(slot.start_time)}
          </span>
          <span className="text-xs text-slate-500 dark:text-cyan-200/40">
            até {formatDT(slot.end_time)}
          </span>
        </div>
        {isAvail && (
          <div className="flex items-center gap-2 shrink-0">
            {isConfirming ? (
              <>
                <span className="text-xs text-red-500 dark:text-red-400 font-medium">Remover?</span>
                <button
                  onClick={() => void handleDelete(slot.id)}
                  disabled={isDel}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-400/40 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  {isDel ? <Spinner sm /> : <Check className="w-3 h-3" />} Sim
                </button>
                <button onClick={() => setConfirmId(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <X className="w-3.5 h-3.5 text-slate-400 dark:text-cyan-200/40" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmId(slot.id)}
                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-cyan-200/30 hover:text-red-500 dark:hover:text-red-400 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600 dark:text-cyan-200/50 font-medium">
          Gerencie seus horários de mentoria individual.
        </p>
        <button onClick={() => setShowModal(true)} className={btnPrimaryCls}>
          <Plus className="w-4 h-4" />
          Adicionar Horário
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Available */}
          <div className={`${cardCls} p-5 flex flex-col gap-3`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-cyan-200/40">
                Disponíveis
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-400/20">
                {available.length}
              </span>
            </div>
            {available.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 dark:text-cyan-200/30">
                Nenhum horário disponível.<br />
                <button onClick={() => setShowModal(true)} className="mt-2 text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">
                  + Adicionar agora
                </button>
              </div>
            ) : (
              available.map((s) => <SlotCard key={s.id} slot={s} />)
            )}
          </div>

          {/* Booked */}
          <div className={`${cardCls} p-5 flex flex-col gap-3`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-cyan-200/40">
                Agendados
              </span>
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-400/20">
                {booked.length}
              </span>
            </div>
            {booked.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 dark:text-cyan-200/30">
                Nenhum agendamento confirmado ainda.
              </div>
            ) : (
              booked.map((s) => <SlotCard key={s.id} slot={s} />)
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <AddSlotModal
            userId={userId}
            onClose={() => setShowModal(false)}
            onCreated={fetchSlots}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── TAB 3: Mentorias Coletivas ────────────────────────────────────────────────

function AddGroupModal({
  userId,
  onClose,
  onCreated,
}: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [startTime, setStart]   = useState("");
  const [endTime, setEnd]       = useState("");
  const [capacity, setCapacity] = useState(10);
  const [saving, setSaving]     = useState(false);

  async function handleCreate() {
    if (!title.trim())  { toast.error("Informe o título da mentoria."); return; }
    if (!startTime || !endTime) { toast.error("Informe início e fim."); return; }
    if (new Date(startTime) >= new Date(endTime)) { toast.error("Início deve ser antes do fim."); return; }
    if (capacity < 1)   { toast.error("Capacidade mínima: 1."); return; }

    setSaving(true);
    try {
      await createGroupMentorship({
        mentor_id:    userId,
        title:        title.trim(),
        description:  desc.trim() || null,
        start_time:   new Date(startTime).toISOString(),
        end_time:     new Date(endTime).toISOString(),
        max_capacity: capacity,
      });
      toast.success("Mentoria coletiva criada!");
      onCreated();
      onClose();
    } catch {
      toast.error("Erro ao criar mentoria coletiva.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`${cardCls} p-6 w-full max-w-md`}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900 dark:text-white">Nova Mentoria Coletiva</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-500 dark:text-cyan-200/50" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Título do Tema</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Casos de Clínica Médica — Turma Junho" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Descrição (opcional)</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descreva os tópicos e o que os alunos podem esperar desta sessão…" rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fim</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Vagas Máximas</label>
            <input type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`${btnSecCls} flex-1 justify-center`}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={`${btnPrimaryCls} flex-1 justify-center`}>
              {saving ? <Spinner sm /> : <Check className="w-4 h-4" />}
              {saving ? "Criando…" : "Criar Mentoria"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TabGrupos({ userId }: { userId: string }) {
  const [groups, setGroups]       = useState<GroupMentorship[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  async function handleDeleteGroup(id: string) {
    setDeleting(id);
    try {
      await deleteGroupMentorship(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success("Mentoria coletiva removida.");
      setConfirmId(null);
    } catch {
      toast.error("Erro ao remover mentoria. Tente novamente.");
    } finally {
      setDeleting(null);
    }
  }

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_mentorships")
        .select(`id, mentor_id, title, description, start_time, end_time, max_capacity, current_bookings,
                 mentor:profiles!group_mentorships_mentor_id_fkey(name, display_name, mentor_avatar_url)`)
        .eq("mentor_id", userId)
        .order("start_time", { ascending: true });

      if (error) throw error;

      const parsed: GroupMentorship[] = ((data ?? []) as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        const mentorRaw = Array.isArray(r.mentor) ? r.mentor[0] : r.mentor;
        const mentor = (mentorRaw ?? {}) as { name: string; display_name: string | null; mentor_avatar_url: string | null };
        return {
          id: r.id as string,
          mentor_id: r.mentor_id as string,
          title: r.title as string,
          description: r.description as string | null,
          start_time: r.start_time as string,
          end_time: r.end_time as string,
          max_capacity: r.max_capacity as number,
          current_bookings: r.current_bookings as number,
          mentor,
        };
      });
      setGroups(parsed);
    } catch {
      toast.error("Erro ao carregar mentorias coletivas.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void fetchGroups(); }, [fetchGroups]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600 dark:text-cyan-200/50 font-medium">
          Sessões em grupo criadas por você.
        </p>
        <button onClick={() => setShowModal(true)} className={btnPrimaryCls}>
          <Plus className="w-4 h-4" />
          Nova Mentoria Coletiva
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : groups.length === 0 ? (
        <div className={`${cardCls} p-10 flex flex-col items-center gap-3 text-center`}>
          <Users className="w-10 h-10 text-slate-300 dark:text-cyan-400/20" />
          <p className="font-semibold text-slate-500 dark:text-cyan-200/50 text-sm">Nenhuma mentoria coletiva ainda</p>
          <button onClick={() => setShowModal(true)} className="text-cyan-600 dark:text-cyan-400 text-sm font-bold hover:underline">
            + Criar primeira sessão
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const pct = g.max_capacity > 0 ? Math.min(100, Math.round((g.current_bookings / g.max_capacity) * 100)) : 0;
            const isFull = g.current_bookings >= g.max_capacity;
            return (
              <div key={g.id} className={`${cardCls} p-5`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 dark:border-cyan-400/20 shrink-0">
                    <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{g.title}</h4>
                      {isFull && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/30">
                          Lotado
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <p className="text-xs text-slate-500 dark:text-cyan-200/40 mt-1 leading-relaxed line-clamp-2">
                        {g.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-cyan-200/40">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDT(g.start_time)}</span>
                      <ChevronRight className="w-3 h-3 opacity-50" />
                      <span>{formatDT(g.end_time)}</span>
                    </div>

                    {/* Occupancy bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-500 dark:text-cyan-200/40">Vagas preenchidas</span>
                        <span className={isFull ? "text-red-500 dark:text-red-400" : "text-cyan-600 dark:text-cyan-400"}>
                          {g.current_bookings} / {g.max_capacity}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`h-full rounded-full ${isFull ? "bg-red-400 dark:bg-red-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"}`}
                        />
                      </div>
                    </div>

                    {/* Delete action */}
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                      {confirmId === g.id ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">Remover definitivamente?</span>
                          <button
                            onClick={() => void handleDeleteGroup(g.id)}
                            disabled={deleting === g.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-400/40 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            {deleting === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Sim
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-slate-400 dark:text-cyan-200/40" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(g.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 dark:text-cyan-200/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-400/20 transition-all duration-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover sessão
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <AddGroupModal
            userId={userId}
            onClose={() => setShowModal(false)}
            onCreated={fetchGroups}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = "perfil" | "agenda" | "grupos";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "perfil",  label: "Meu Perfil",          Icon: UserCheck  },
  { id: "agenda",  label: "Minha Agenda",         Icon: Calendar   },
  { id: "grupos",  label: "Mentorias Coletivas",  Icon: Users      },
];

export default function MentorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("perfil");

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 pb-6">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2"
      >
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-cyan-300 bg-clip-text text-transparent">
          Painel do Mentor
        </h1>
        <p className="text-slate-600 dark:text-cyan-200/60 font-medium text-sm mt-1">
          Gerencie suas disponibilidades, atualize suas especialidades e acompanhe seus alunos.
        </p>
      </motion.div>

      {/* ── Tab switcher ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold
                transition-all duration-250 select-none
                ${active
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25"
                  : "text-slate-500 dark:text-cyan-200/50 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">{label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "perfil" && <TabPerfil userId={user.id} />}
          {tab === "agenda" && <TabAgenda userId={user.id} />}
          {tab === "grupos" && <TabGrupos userId={user.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
