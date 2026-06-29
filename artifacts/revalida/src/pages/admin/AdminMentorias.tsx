import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, UserCircle2, ChevronDown, Check, Plus,
  Trash2, Pencil, Clock, History, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  updateMentorProfile,
  createIndividualSlot,
  createGroupMentorship,
  listMentorsWithRatings,
  listAllSlotsAdmin,
  deleteIndividualSlot,
  listAllGroupMentorshipsAdmin,
  updateGroupMentorship,
  deleteGroupMentorship,
  type MentorWithRating,
  type AdminSlot,
  type AdminGroupMentorship,
} from "@/lib/mentorshipService";

// ── shared styles ──────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-white/5 border border-cyan-400/20 focus:border-cyan-400/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-cyan-200/25 outline-none transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-cyan-200/40 mb-1.5";

interface ProfileRow {
  id: string;
  name: string;
  display_name: string | null;
  is_mentor: boolean;
  mentor_bio: string | null;
  mentor_specialty: string | null;
}

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <div
      className={`border-2 border-current border-t-transparent rounded-full animate-spin ${
        sm ? "w-3 h-3" : "w-4 h-4"
      }`}
    />
  );
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-bold text-cyan-200/30 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/8">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-cyan-400/10" />
    </div>
  );
}

// ── Delete confirm inline ──────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-red-300 font-medium">Confirmar?</span>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
      >
        {loading ? <Spinner sm /> : <Check className="w-3 h-3" />}
        Sim
      </button>
      <button
        onClick={onCancel}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-cyan-200/40 hover:text-white transition-all"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-tab 1: Médicos & Mentores
// ════════════════════════════════════════════════════════════════════════════
function MentorManagement() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { bio: string; specialty: string }>>({});

  useEffect(() => {
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, name, display_name, is_mentor, mentor_bio, mentor_specialty")
      .order("name")
      .then(({ data, error }) => {
        if (error) { toast.error("Erro ao carregar perfis"); return; }
        setProfiles((data ?? []) as ProfileRow[]);
        const initial: Record<string, { bio: string; specialty: string }> = {};
        for (const p of data ?? []) {
          initial[p.id] = { bio: p.mentor_bio ?? "", specialty: p.mentor_specialty ?? "" };
        }
        setEdits(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleMentor(p: ProfileRow) {
    setSaving(p.id);
    try {
      await updateMentorProfile(p.id, { is_mentor: !p.is_mentor });
      setProfiles((prev) => prev.map((x) => x.id === p.id ? { ...x, is_mentor: !x.is_mentor } : x));
      toast.success(p.is_mentor ? `${p.name} removido de mentores` : `${p.name} promovido a mentor`);
    } catch { toast.error("Erro ao atualizar status de mentor"); }
    finally { setSaving(null); }
  }

  async function saveMentorProfile(p: ProfileRow) {
    setSaving(p.id + "_save");
    try {
      const e = edits[p.id];
      await updateMentorProfile(p.id, { mentor_bio: e?.bio || null, mentor_specialty: e?.specialty || null });
      toast.success("Perfil de mentor salvo");
    } catch { toast.error("Erro ao salvar perfil"); }
    finally { setSaving(null); }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-3">
      {profiles.map((p) => {
        const displayName = p.display_name || p.name;
        const edit = edits[p.id] ?? { bio: "", specialty: "" };
        const isTogglingThis = saving === p.id;
        const isSavingThis = saving === p.id + "_save";
        return (
          <div key={p.id} className={`relative bg-[#0a1628] border rounded-2xl p-4 transition-all overflow-hidden ${p.is_mentor ? "border-cyan-400/35" : "border-white/8"}`}>
            {p.is_mentor && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <UserCircle2 className="w-5 h-5 text-cyan-400/50" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{displayName}</p>
                  <p className="text-cyan-200/35 text-xs truncate">{p.id.slice(0, 8)}…</p>
                </div>
              </div>
              <button
                onClick={() => toggleMentor(p)}
                disabled={!!saving}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${p.is_mentor ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300 hover:bg-red-500/10 hover:border-red-400/40 hover:text-red-300" : "bg-white/5 border-white/10 text-cyan-200/40 hover:bg-cyan-500/10 hover:border-cyan-400/30 hover:text-cyan-300"}`}
              >
                {isTogglingThis ? <Spinner sm /> : p.is_mentor ? <><Check className="w-3 h-3" /> Mentor</> : <><Plus className="w-3 h-3" /> Promover</>}
              </button>
            </div>
            {p.is_mentor && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Especialidade</label>
                  <input className={inputCls} placeholder="Ex: Clínica Médica, Cirurgia…" value={edit.specialty}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], specialty: e.target.value } }))} />
                </div>
                <div>
                  <label className={labelCls}>Bio</label>
                  <input className={inputCls} placeholder="Breve descrição do mentor…" value={edit.bio}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], bio: e.target.value } }))} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button onClick={() => saveMentorProfile(p)} disabled={!!saving}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 border border-cyan-400/35 text-cyan-300 hover:bg-cyan-500/30 transition-all disabled:opacity-50">
                    {isSavingThis ? <Spinner sm /> : <Check className="w-3 h-3" />}
                    Salvar perfil
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-tab 2: Slots Individuais
// ════════════════════════════════════════════════════════════════════════════
function SlotScheduler() {
  const [mentors, setMentors] = useState<MentorWithRating[]>([]);
  const [mentorId, setMentorId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);

  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [filter, setFilter] = useState<"ativos" | "historico">("ativos");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reloadSlots = useCallback(() => {
    setLoadingSlots(true);
    listAllSlotsAdmin()
      .then(setSlots)
      .catch(() => toast.error("Erro ao carregar slots"))
      .finally(() => setLoadingSlots(false));
  }, []);

  useEffect(() => {
    listMentorsWithRatings().then(setMentors).catch(() => toast.error("Erro ao carregar mentores"));
    reloadSlots();
  }, [reloadSlots]);

  async function handleCreate() {
    if (!mentorId || !startTime || !endTime) { toast.error("Preencha todos os campos"); return; }
    if (new Date(endTime) <= new Date(startTime)) { toast.error("Horário de término deve ser após o início"); return; }
    setSaving(true);
    try {
      await createIndividualSlot(mentorId, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      toast.success("Horário criado com sucesso");
      setStartTime(""); setEndTime("");
      reloadSlots();
    } catch { toast.error("Erro ao criar horário"); }
    finally { setSaving(false); }
  }

  async function handleDelete(slotId: string) {
    setDeleting(true);
    try {
      await deleteIndividualSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      toast.success("Slot excluído");
      setConfirmDelete(null);
    } catch { toast.error("Erro ao excluir slot"); }
    finally { setDeleting(false); }
  }

  const now = new Date();
  const active = slots.filter((s) => new Date(s.end_time) >= now);
  const historic = slots.filter((s) => new Date(s.end_time) < now);
  const displayed = filter === "ativos" ? active : historic;

  return (
    <div className="flex flex-col gap-6">
      {/* Creation form */}
      <div className="relative bg-[#0a1628] border border-cyan-400/20 rounded-2xl p-6 max-w-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
        <h3 className="text-white font-bold text-base mb-5">Novo horário individual</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Mentor</label>
            <div className="relative">
              <select className={`${inputCls} appearance-none pr-8`} value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
                <option value="">Selecione um mentor…</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/40 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início</label>
              <input type="datetime-local" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Término</label>
              <input type="datetime-local" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="mt-1 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border border-cyan-400/35 text-cyan-300 hover:from-cyan-500/30 hover:border-cyan-400/60 transition-all disabled:opacity-50">
            {saving ? <Spinner /> : <><Calendar className="w-4 h-4" /> Criar Horário Aberto</>}
          </button>
        </div>
      </div>

      {/* Slot list */}
      <div>
        {/* Filter toggle */}
        <div className="flex items-center gap-2 mb-4">
          {(["ativos", "historico"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === f ? "bg-cyan-500/20 border-cyan-400/35 text-cyan-300" : "bg-white/5 border-white/8 text-cyan-200/35 hover:text-cyan-200/60"}`}>
              {f === "ativos" ? <><Clock className="w-3 h-3" /> Ativos ({active.length})</> : <><History className="w-3 h-3" /> Histórico ({historic.length})</>}
            </button>
          ))}
        </div>

        {loadingSlots ? (
          <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-10 text-cyan-200/30 text-sm">
            {filter === "ativos" ? "Nenhum slot ativo." : "Nenhum slot no histórico."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayed.map((slot) => {
              const isPast = new Date(slot.end_time) < now;
              const isConfirming = confirmDelete === slot.id;
              return (
                <div key={slot.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${isPast ? "bg-white/[0.02] border-white/8" : "bg-[#0a1628] border-cyan-400/15 hover:border-cyan-400/30"}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-sm font-semibold truncate">{slot.mentor_name}</span>
                    <span className="text-cyan-200/40 text-xs">
                      {formatDT(slot.start_time)} → {formatDT(slot.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isPast ? "text-white/25 bg-white/5 border-white/8" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}`}>
                      {isPast ? "Encerrado" : "Ativo"}
                    </span>
                    {!isPast && (
                      isConfirming ? (
                        <DeleteConfirm
                          onConfirm={() => handleDelete(slot.id)}
                          onCancel={() => setConfirmDelete(null)}
                          loading={deleting}
                        />
                      ) : (
                        <button onClick={() => setConfirmDelete(slot.id)}
                          className="p-1.5 rounded-lg text-cyan-200/30 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Edit Modal for Group Mentorship
// ════════════════════════════════════════════════════════════════════════════
function EditGroupModal({
  group,
  onClose,
  onSaved,
}: {
  group: AdminGroupMentorship;
  onClose: () => void;
  onSaved: (updated: AdminGroupMentorship) => void;
}) {
  function toLocalDT(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const [form, setForm] = useState({
    title: group.title,
    description: group.description ?? "",
    start_time: toLocalDT(group.start_time),
    end_time: toLocalDT(group.end_time),
    max_capacity: String(group.max_capacity),
  });
  const [saving, setSaving] = useState(false);

  function setField(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.title || !form.start_time || !form.end_time) { toast.error("Preencha os campos obrigatórios"); return; }
    if (new Date(form.end_time) <= new Date(form.start_time)) { toast.error("Término deve ser após o início"); return; }
    const cap = parseInt(form.max_capacity, 10);
    if (isNaN(cap) || cap < 1) { toast.error("Capacidade deve ser no mínimo 1"); return; }
    setSaving(true);
    try {
      await updateGroupMentorship(group.id, {
        title: form.title,
        description: form.description || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        max_capacity: cap,
      });
      toast.success("Mentoria atualizada");
      onSaved({
        ...group,
        title: form.title,
        description: form.description || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        max_capacity: cap,
      });
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-[#0a1628] border border-cyan-400/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-bold text-base">Editar mentoria em grupo</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-cyan-200/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>Título *</label>
              <input className={inputCls} value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Início *</label>
                <input type="datetime-local" className={inputCls} value={form.start_time} onChange={(e) => setField("start_time", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Término *</label>
                <input type="datetime-local" className={inputCls} value={form.end_time} onChange={(e) => setField("end_time", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Capacidade máxima</label>
              <input type="number" min={1} className={inputCls} value={form.max_capacity} onChange={(e) => setField("max_capacity", e.target.value)} />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border border-cyan-400/35 text-cyan-300 hover:from-cyan-500/30 hover:border-cyan-400/60 transition-all disabled:opacity-50">
              {saving ? <Spinner /> : <><Check className="w-4 h-4" /> Salvar alterações</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-tab 3: Mentorias em Grupo
// ════════════════════════════════════════════════════════════════════════════
function GroupScheduler() {
  const [mentors, setMentors] = useState<MentorWithRating[]>([]);
  const [form, setForm] = useState({ mentor_id: "", title: "", description: "", start_time: "", end_time: "", max_capacity: "10" });
  const [saving, setSaving] = useState(false);

  const [groups, setGroups] = useState<AdminGroupMentorship[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminGroupMentorship | null>(null);

  const reloadGroups = useCallback(() => {
    setLoadingGroups(true);
    listAllGroupMentorshipsAdmin()
      .then(setGroups)
      .catch(() => toast.error("Erro ao carregar mentorias"))
      .finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    listMentorsWithRatings().then(setMentors).catch(() => toast.error("Erro ao carregar mentores"));
    reloadGroups();
  }, [reloadGroups]);

  function setField(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handlePublish() {
    if (!form.mentor_id || !form.title || !form.start_time || !form.end_time) { toast.error("Preencha os campos obrigatórios"); return; }
    if (new Date(form.end_time) <= new Date(form.start_time)) { toast.error("Término deve ser após o início"); return; }
    const cap = parseInt(form.max_capacity, 10);
    if (isNaN(cap) || cap < 1) { toast.error("Capacidade mínima é 1"); return; }
    setSaving(true);
    try {
      await createGroupMentorship({ mentor_id: form.mentor_id, title: form.title, description: form.description || null, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString(), max_capacity: cap });
      toast.success("Mentoria em grupo publicada");
      setForm((p) => ({ ...p, title: "", description: "", start_time: "", end_time: "", max_capacity: "10" }));
      reloadGroups();
    } catch { toast.error("Erro ao publicar mentoria"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteGroupMentorship(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success("Mentoria excluída");
      setConfirmDelete(null);
    } catch { toast.error("Erro ao excluir"); }
    finally { setDeleting(false); }
  }

  const now = new Date();
  const upcoming = groups.filter((g) => new Date(g.start_time) >= now);
  const past = groups.filter((g) => new Date(g.end_time) < now);

  function GroupRow({ g }: { g: AdminGroupMentorship }) {
    const isPast = new Date(g.end_time) < now;
    const pct = Math.min(100, (g.current_bookings / g.max_capacity) * 100);
    const isConfirming = confirmDelete === g.id;
    return (
      <div className={`relative flex flex-col gap-3 p-4 rounded-xl border transition-all ${isPast ? "bg-white/[0.02] border-white/8" : "bg-[#0a1628] border-cyan-400/15 hover:border-cyan-400/25"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{g.title}</p>
            <p className="text-cyan-200/40 text-xs mt-0.5">Dr. {g.mentor_name} · {formatDT(g.start_time)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold tabular-nums text-cyan-300/60 bg-cyan-400/8 border border-cyan-400/15 px-2 py-0.5 rounded-full">
              {g.current_bookings}/{g.max_capacity}
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-cyan-500"}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center justify-end gap-2">
          {isConfirming ? (
            <DeleteConfirm onConfirm={() => handleDelete(g.id)} onCancel={() => setConfirmDelete(null)} loading={deleting} />
          ) : (
            <>
              {!isPast && (
                <button onClick={() => setEditTarget(g)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-cyan-200/50 hover:text-cyan-300 hover:border-cyan-400/30 transition-all">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              )}
              <button onClick={() => setConfirmDelete(g.id)}
                className="p-1.5 rounded-lg text-cyan-200/30 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Creation form */}
      <div className="relative bg-[#0a1628] border border-cyan-400/20 rounded-2xl p-6 max-w-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
        <h3 className="text-white font-bold text-base mb-5">Nova mentoria em grupo</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Mentor *</label>
            <div className="relative">
              <select className={`${inputCls} appearance-none pr-8`} value={form.mentor_id} onChange={(e) => setField("mentor_id", e.target.value)}>
                <option value="">Selecione um mentor…</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/40 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Título *</label>
            <input className={inputCls} placeholder="Ex: Clínica Médica — Turma Junho" value={form.title} onChange={(e) => setField("title", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Tópicos abordados, pré-requisitos, etc." value={form.description} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início *</label>
              <input type="datetime-local" className={inputCls} value={form.start_time} onChange={(e) => setField("start_time", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Término *</label>
              <input type="datetime-local" className={inputCls} value={form.end_time} onChange={(e) => setField("end_time", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Capacidade máxima</label>
            <input type="number" min={1} className={inputCls} value={form.max_capacity} onChange={(e) => setField("max_capacity", e.target.value)} />
          </div>
          <button onClick={handlePublish} disabled={saving}
            className="mt-1 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border border-cyan-400/35 text-cyan-300 hover:from-cyan-500/30 hover:border-cyan-400/60 transition-all disabled:opacity-50">
            {saving ? <Spinner /> : <><Users className="w-4 h-4" /> Publicar Mentoria Coletiva</>}
          </button>
        </div>
      </div>

      {/* Sessions list */}
      {loadingGroups ? (
        <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Upcoming */}
          <div>
            <SectionHeader label="Próximas Sessões" count={upcoming.length} />
            {upcoming.length === 0 ? (
              <p className="text-cyan-200/30 text-sm text-center py-6">Nenhuma sessão futura agendada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map((g) => <GroupRow key={g.id} g={g} />)}
              </div>
            )}
          </div>

          {/* History */}
          {past.length > 0 && (
            <div>
              <SectionHeader label="Histórico de Sessões" count={past.length} />
              <div className="flex flex-col gap-2">
                {past.map((g) => <GroupRow key={g.id} g={g} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editTarget && (
          <EditGroupModal
            group={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={(updated) => {
              setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
              setEditTarget(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════════════════
const SUB_TABS = [
  { key: "mentors" as const, label: "Médicos & Mentores", icon: Users },
  { key: "slots"   as const, label: "Slots Individuais",  icon: Clock },
  { key: "groups"  as const, label: "Mentorias em Grupo", icon: Calendar },
];

export default function AdminMentorias() {
  const [tab, setTab] = useState<"mentors" | "slots" | "groups">("mentors");

  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-1 pt-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Gerenciar Mentorias</h1>
        <p className="text-cyan-200/50 font-medium mt-1 text-sm">
          Promova mentores, gerencie perfis e publique ou edite horários individuais e em grupo.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="flex flex-wrap gap-2 p-1 bg-white/5 border border-cyan-400/15 rounded-xl w-fit">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.1)]" : "text-cyan-200/40 hover:text-cyan-200/70"}`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === "mentors" && (
          <motion.div key="mentors" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <MentorManagement />
          </motion.div>
        )}
        {tab === "slots" && (
          <motion.div key="slots" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <SlotScheduler />
          </motion.div>
        )}
        {tab === "groups" && (
          <motion.div key="groups" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
            <GroupScheduler />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
