export type PlanoTipo = "treino" | "revisao" | "resumo";
export type PlanoDia = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PlanoBloco = {
  id: string;
  dia: PlanoDia;
  horario: string;
  area: string;
  tipo: PlanoTipo;
  titulo?: string;
};

const STORAGE_KEY = "revalida.plano.blocos";
const SEEDED_KEY = "revalida.plano.seeded";

export const PLANO_DIAS: { value: PlanoDia; short: string; full: string }[] = [
  { value: 1, short: "Seg", full: "Segunda-feira" },
  { value: 2, short: "Ter", full: "Terça-feira" },
  { value: 3, short: "Qua", full: "Quarta-feira" },
  { value: 4, short: "Qui", full: "Quinta-feira" },
  { value: 5, short: "Sex", full: "Sexta-feira" },
  { value: 6, short: "Sáb", full: "Sábado" },
  { value: 0, short: "Dom", full: "Domingo" },
];

export const PLANO_AREAS = [
  "Clínica médica",
  "Cirurgia",
  "Pediatria",
  "GO",
  "MFC",
];

export const PLANO_TIPOS: { value: PlanoTipo; label: string }[] = [
  { value: "treino", label: "Treino" },
  { value: "revisao", label: "Revisão" },
  { value: "resumo", label: "Resumo" },
];

export const AREA_TONES: Record<string, string> = {
  "Clínica médica": "from-blue-500/20 to-blue-500/5 border-blue-400/40 text-blue-700 dark:text-blue-300",
  Cirurgia: "from-rose-500/20 to-rose-500/5 border-rose-400/40 text-rose-700 dark:text-rose-300",
  Pediatria: "from-amber-500/20 to-amber-500/5 border-amber-400/40 text-amber-700 dark:text-amber-300",
  GO: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-400/40 text-fuchsia-700 dark:text-fuchsia-300",
  MFC: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/40 text-emerald-700 dark:text-emerald-300",
};

export const TIPO_TONES: Record<PlanoTipo, string> = {
  treino: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/40",
  revisao: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-400/40",
  resumo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40",
};

function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

export function listBlocos(): PlanoBloco[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as PlanoBloco[]) : [];
  } catch {
    return [];
  }
}

export function saveBlocos(blocos: PlanoBloco[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocos));
}

export function addBloco(b: Omit<PlanoBloco, "id">): PlanoBloco {
  const all = listBlocos();
  const novo: PlanoBloco = { ...b, id: genId() };
  all.push(novo);
  saveBlocos(all);
  return novo;
}

export function updateBloco(b: PlanoBloco) {
  const all = listBlocos().map((x) => (x.id === b.id ? b : x));
  saveBlocos(all);
}

export function deleteBloco(id: string) {
  const all = listBlocos().filter((x) => x.id !== id);
  saveBlocos(all);
}

export function newBloco(dia: PlanoDia = 1): Omit<PlanoBloco, "id"> {
  return {
    dia,
    horario: "19:00",
    area: "Clínica médica",
    tipo: "treino",
    titulo: "",
  };
}

export function seedPlanoIfEmpty() {
  if (localStorage.getItem(SEEDED_KEY) === "1") return;
  if (listBlocos().length > 0) {
    localStorage.setItem(SEEDED_KEY, "1");
    return;
  }
  const seed: PlanoBloco[] = [
    { id: genId(), dia: 1, horario: "07:30", area: "Clínica médica", tipo: "revisao", titulo: "ECG e arritmias" },
    { id: genId(), dia: 1, horario: "19:00", area: "Cirurgia", tipo: "treino", titulo: "Abdome agudo" },
    { id: genId(), dia: 2, horario: "20:00", area: "Pediatria", tipo: "treino", titulo: "Febre sem foco" },
    { id: genId(), dia: 3, horario: "07:00", area: "MFC", tipo: "resumo", titulo: "Visita domiciliar" },
    { id: genId(), dia: 3, horario: "19:30", area: "GO", tipo: "treino", titulo: "Pré-eclâmpsia" },
    { id: genId(), dia: 4, horario: "20:00", area: "Clínica médica", tipo: "treino", titulo: "Insuficiência cardíaca" },
    { id: genId(), dia: 5, horario: "19:00", area: "Pediatria", tipo: "revisao", titulo: "Calendário vacinal" },
    { id: genId(), dia: 6, horario: "09:00", area: "Cirurgia", tipo: "treino", titulo: "Trauma torácico" },
    { id: genId(), dia: 6, horario: "15:00", area: "GO", tipo: "resumo", titulo: "Sangramento uterino" },
    { id: genId(), dia: 0, horario: "10:00", area: "Clínica médica", tipo: "revisao", titulo: "Revisão semanal" },
  ];
  saveBlocos(seed);
  localStorage.setItem(SEEDED_KEY, "1");
}
