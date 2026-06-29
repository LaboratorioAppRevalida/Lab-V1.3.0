export type TrainingUser = {
  id: string;
  nome: string;
  online: boolean;
  nota: number;
  favorito: boolean;
  estacoes: number;
  /** true = usuário real via Supabase Presence; false/undefined = mock de desenvolvimento */
  isReal?: boolean;
  /** status de presença do usuário real */
  userStatus?: "available" | "matchmaking" | "busy" | "in_session";
};

export const MOCK_USERS: TrainingUser[] = [
  { id: "u-001", nome: "Mariana Castro", online: true, nota: 4.82, favorito: true, estacoes: 142 },
  { id: "u-002", nome: "Rafael Lima", online: true, nota: 4.65, favorito: false, estacoes: 98 },
  { id: "u-003", nome: "Beatriz Souza", online: false, nota: 4.41, favorito: true, estacoes: 76 },
  { id: "u-004", nome: "Felipe Andrade", online: true, nota: 4.27, favorito: false, estacoes: 64 },
  { id: "u-005", nome: "Camila Ferreira", online: false, nota: 4.18, favorito: false, estacoes: 51 },
  { id: "u-006", nome: "Lucas Martins", online: true, nota: 3.96, favorito: false, estacoes: 47 },
  { id: "u-007", nome: "Júlia Mendes", online: true, nota: 3.84, favorito: false, estacoes: 39 },
  { id: "u-008", nome: "Pedro Henrique", online: false, nota: 3.72, favorito: false, estacoes: 33 },
  { id: "u-009", nome: "Ana Beatriz", online: true, nota: 3.58, favorito: false, estacoes: 28 },
  { id: "u-010", nome: "Gustavo Pires", online: false, nota: 3.45, favorito: false, estacoes: 24 },
  { id: "u-011", nome: "Larissa Rocha", online: true, nota: 3.31, favorito: false, estacoes: 21 },
  { id: "u-012", nome: "Tiago Barreto", online: true, nota: 3.12, favorito: false, estacoes: 18 },
];

export const ROTATING_WAITING_MESSAGES = [
  "Prepare-se...",
  "Respire fundo...",
  "Você consegue!",
  "Revise suas hipóteses diagnósticas",
  "Mantenha a empatia com o paciente",
  "Foque na sequência da anamnese",
  "Confiança é tudo.",
];

export const QUICK_AREAS = [
  "Aleatório",
  "Clínica médica",
  "Cirurgia",
  "Pediatria",
  "GO",
  "MFC",
] as const;

export type QuickArea = (typeof QUICK_AREAS)[number];
