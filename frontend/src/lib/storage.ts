// Persistência de problemas no navegador (localStorage) e import/export JSON.
// Permite nomear, salvar, recarregar e compartilhar problemas inteiros.

import type { Problem } from "@/lib/templates";

const KEY = "promethee.savedProblems.v1";

export interface SavedProblem {
  id: string;
  name: string;
  savedAt: number;
  problem: Problem;
}

function read(): SavedProblem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedProblem[]) : [];
  } catch {
    return [];
  }
}

function write(items: SavedProblem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function listSaved(): SavedProblem[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

// Salva (ou substitui, se já existir um com o mesmo nome) e devolve a lista.
export function saveProblem(name: string, problem: Problem): SavedProblem[] {
  const items = read();
  const trimmed = name.trim() || "Sem nome";
  const entry: SavedProblem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    savedAt: Date.now(),
    problem: { ...problem, name: trimmed },
  };
  const without = items.filter((it) => it.name !== trimmed);
  write([entry, ...without]);
  return listSaved();
}

export function deleteSaved(id: string): SavedProblem[] {
  write(read().filter((it) => it.id !== id));
  return listSaved();
}

// Valida e normaliza um objeto desconhecido (vindo de JSON importado) num
// Problem consistente. Lança Error com mensagem amigável se inválido.
export function parseProblem(raw: unknown): Problem {
  if (!raw || typeof raw !== "object") {
    throw new Error("Arquivo inválido: não é um objeto JSON.");
  }
  const obj = raw as Record<string, unknown>;
  const alternatives = obj.alternatives;
  const criteria = obj.criteria;
  const matrix = obj.matrix;

  if (!Array.isArray(alternatives) || alternatives.length < 2) {
    throw new Error("São necessárias ao menos 2 alternativas.");
  }
  if (!Array.isArray(criteria) || criteria.length < 1) {
    throw new Error("É necessário ao menos 1 critério.");
  }
  if (!Array.isArray(matrix) || matrix.length !== alternatives.length) {
    throw new Error("A matriz não bate com o número de alternativas.");
  }
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== criteria.length) {
      throw new Error("As linhas da matriz não batem com o número de critérios.");
    }
  }

  return {
    name: typeof obj.name === "string" && obj.name ? obj.name : "Problema importado",
    alternatives: alternatives.map(String),
    criteria: criteria as Problem["criteria"],
    matrix: matrix.map((row) => (row as unknown[]).map(Number)),
  };
}

// Dispara o download do problema como arquivo .json.
export function exportProblemFile(problem: Problem): void {
  const blob = new Blob([JSON.stringify(problem, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (problem.name || "problema")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  a.href = url;
  a.download = `${slug || "problema"}.promethee.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Lê um File e devolve o Problem validado.
export async function importProblemFile(file: File): Promise<Problem> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Não foi possível ler o JSON do arquivo.");
  }
  return parseProblem(parsed);
}
