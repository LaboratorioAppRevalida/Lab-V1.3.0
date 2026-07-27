export type Nota = {
  id: string;
  titulo: string;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "revalida.notas";

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

export function listNotas(): Nota[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const list: Nota[] = data ? JSON.parse(data) : [];
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getNota(id: string): Nota | undefined {
  return listNotas().find((n) => n.id === id);
}

export function saveNota(nota: Nota): void {
  const all = listNotas();
  const idx = all.findIndex((n) => n.id === nota.id);
  nota.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = nota;
  } else {
    nota.createdAt = nota.updatedAt;
    all.unshift(nota);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteNota(id: string): void {
  const all = listNotas().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function newNota(): Nota {
  return {
    id: generateId(),
    titulo: "",
    conteudo: "",
    createdAt: "",
    updatedAt: "",
  };
}
