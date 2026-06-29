// Tipos do módulo de Checklists — mantidos aqui para compatibilidade com imports existentes.
// O armazenamento foi migrado para Supabase; use src/lib/checklistService.ts para CRUD.

export type ImpressoItem = {
  id: string;
  titulo: string;
  tipo: "texto" | "imagem";
  conteudo: string;
};

export type PepBlock = {
  id: string;
  titulo: string;
  texto: string;
  scoreAdequado: number;
  scoreParcial: number;
};

/** Full station dataset — used only when a station is active in training. */
export type Checklist = {
  id: string;
  title: string;
  grandeArea: string;
  subarea: string;
  cenarioAtuacao: string;
  descricaoCaso: string;
  tarefas: string;
  impressos: ImpressoItem[];
  roteiroPaciente: string;
  pepBlocks: PepBlock[];
  createdAt: string;
  updatedAt: string;
  /** UUID of the user who originally created this station. */
  createdBy?: string;
  /** false = pending admin review (colaborador submissions); true = visible in catalog. */
  isApproved?: boolean;
};

/**
 * Lightweight catalog representation — used for listing/filtering stations.
 *
 * Heavy fields (descricaoCaso, tarefas, roteiroPaciente, impressos, pepBlocks.texto)
 * are NOT included. They are fetched on demand via fetchChecklistDetailsForTraining()
 * exactly when the user confirms station selection, preventing students from reading
 * exam content by inspecting network payloads before the session begins.
 */
export type ChecklistSummary = {
  id: string;
  title: string;
  grandeArea: string;
  subarea: string;
  cenarioAtuacao: string;
  /** Derived from pep_blocks array length — count only, no scoring text. */
  pepBlockCount: number;
  createdAt: string;
  updatedAt: string;
};
