// Tipos e cliente da API PROMETHEE II.
// O contrato espelha os schemas Pydantic do backend (app/schemas.py).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PreferenceType =
  | "usual"
  | "u_shape"
  | "v_shape"
  | "level"
  | "linear"
  | "gaussian";

// Um termo de uma escala qualitativa: rótulo linguístico → valor numérico.
export interface ScaleTerm {
  term: string;
  value: number;
}

export interface CriterionInput {
  name: string;
  weight: number;
  maximize: boolean;
  preference: PreferenceType;
  q?: number | null;
  p?: number | null;
  s?: number | null;
  // Quando presente, o critério é qualitativo: as células da matriz são
  // escolhidas entre estes termos (a matriz enviada à API continua numérica).
  scale?: ScaleTerm[] | null;
}

export interface SolveRequest {
  name?: string | null;
  alternatives: string[];
  criteria: CriterionInput[];
  matrix: number[][];
}

export interface ScoreOutput {
  name: string;
  phi_plus: number;
  phi_minus: number;
  phi_net: number;
  rank: number;
}

export interface GaiaPoint {
  name: string;
  x: number;
  y: number;
}

export interface GaiaOutput {
  alternatives: GaiaPoint[];
  criteria: GaiaPoint[];
  decision_axis: GaiaPoint;
  quality: number;
}

export interface SolveResponse {
  scores: ScoreOutput[];
  gaia: GaiaOutput | null;
  preference_index: number[][];
}

export interface CriterionStability {
  name: string;
  weight: number;
  rank_lower: number;
  rank_upper: number;
  winner_lower: number;
  winner_upper: number;
}

export interface SensitivityResponse {
  base_order: string[];
  criteria: CriterionStability[];
}

// Quais parâmetros (q/p/s) cada tipo de função de preferência exige.
export const PREFERENCE_PARAMS: Record<PreferenceType, ("q" | "p" | "s")[]> = {
  usual: [],
  u_shape: ["q"],
  v_shape: ["p"],
  level: ["q", "p"],
  linear: ["q", "p"],
  gaussian: ["s"],
};

export const PREFERENCE_LABELS: Record<PreferenceType, string> = {
  usual: "Tipo I — Usual",
  u_shape: "Tipo II — Quase-critério (U)",
  v_shape: "Tipo III — Linear (V)",
  level: "Tipo IV — Nível",
  linear: "Tipo V — Linear c/ indiferença",
  gaussian: "Tipo VI — Gaussiana",
};

// A escala qualitativa é um conceito de frontend; o backend só recebe números.
function sanitizeRequest(req: SolveRequest): SolveRequest {
  return {
    ...req,
    criteria: req.criteria.map(({ scale, ...c }) => c),
  };
}

async function postJson<T>(path: string, body: SolveRequest): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizeRequest(body)),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(formatError(detail) ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function formatError(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const d = (detail as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e: { msg?: string }) => e.msg).filter(Boolean).join("; ");
  }
  return null;
}

export function solve(req: SolveRequest): Promise<SolveResponse> {
  return postJson<SolveResponse>("/api/solve", req);
}

export function sensitivity(req: SolveRequest): Promise<SensitivityResponse> {
  return postJson<SensitivityResponse>("/api/sensitivity", req);
}

export async function exportFile(
  format: "csv" | "pdf",
  req: SolveRequest,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizeRequest(req)),
  });
  if (!res.ok) throw new Error(`Falha ao exportar ${format.toUpperCase()}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `promethee_ii.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
