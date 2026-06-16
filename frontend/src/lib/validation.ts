// Validação guiada do problema no frontend — espelha as regras do backend
// (schemas.py + core/flows.py) para que erros de q/p/s, pesos e nomes apareçam
// inline *antes* de calcular, em vez de só como erro 422 da API.

import { PREFERENCE_PARAMS, type CriterionInput } from "@/lib/api";
import type { Problem } from "@/lib/templates";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  message: string;
  // Quando o problema é de um critério específico, seu índice (para destacar).
  criterion?: number;
}

export interface ValidationResult {
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
  // Índices de critérios com ao menos um erro (para marcar na tabela).
  criterionErrors: Set<number>;
  ok: boolean; // sem erros bloqueantes
}

function checkThresholds(c: CriterionInput, i: number): Issue[] {
  const out: Issue[] = [];
  const required = PREFERENCE_PARAMS[c.preference];
  const has = (v: number | null | undefined) => v !== null && v !== undefined && !Number.isNaN(v);

  for (const param of required) {
    if (!has(c[param])) {
      out.push({
        level: "error",
        criterion: i,
        message: `"${c.name}": o parâmetro ${param} é obrigatório para ${c.preference}.`,
      });
    }
  }

  const q = c.q ?? null;
  const p = c.p ?? null;
  const s = c.s ?? null;

  if (q !== null && q < 0)
    out.push({ level: "error", criterion: i, message: `"${c.name}": q deve ser ≥ 0.` });
  if (p !== null && p < 0)
    out.push({ level: "error", criterion: i, message: `"${c.name}": p deve ser ≥ 0.` });
  if (s !== null && s <= 0)
    out.push({ level: "error", criterion: i, message: `"${c.name}": s deve ser > 0.` });

  if (c.preference === "v_shape" && p !== null && p <= 0)
    out.push({ level: "error", criterion: i, message: `"${c.name}": p deve ser > 0 (V-shape).` });
  if (c.preference === "level" && q !== null && p !== null && p < q)
    out.push({ level: "error", criterion: i, message: `"${c.name}": p deve ser ≥ q (Nível).` });
  if (c.preference === "linear" && q !== null && p !== null && p <= q)
    out.push({ level: "error", criterion: i, message: `"${c.name}": p deve ser > q (Linear).` });

  return out;
}

export function validateProblem(problem: Problem): ValidationResult {
  const { alternatives, criteria, matrix } = problem;
  const issues: Issue[] = [];

  // --- alternativas ---
  if (alternatives.length < 2)
    issues.push({ level: "error", message: "São necessárias ao menos 2 alternativas." });

  const blankAlt = alternatives.some((a) => !a.trim());
  if (blankAlt) issues.push({ level: "error", message: "Toda alternativa precisa de um nome." });

  const altNames = alternatives.map((a) => a.trim());
  if (new Set(altNames).size !== altNames.length)
    issues.push({ level: "error", message: "Nomes de alternativas devem ser únicos." });

  // --- critérios ---
  if (criteria.length < 1)
    issues.push({ level: "error", message: "É necessário ao menos 1 critério." });

  const critNames = criteria.map((c) => c.name.trim());
  if (criteria.some((c) => !c.name.trim()))
    issues.push({ level: "error", message: "Todo critério precisa de um nome." });
  if (new Set(critNames).size !== critNames.length)
    issues.push({ level: "error", message: "Nomes de critérios devem ser únicos." });

  criteria.forEach((c, i) => {
    if (!(Number(c.weight) > 0))
      issues.push({ level: "error", criterion: i, message: `"${c.name}": o peso deve ser > 0.` });
    issues.push(...checkThresholds(c, i));
  });

  const weightSum = criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
  if (weightSum <= 0) {
    issues.push({ level: "error", message: "A soma dos pesos deve ser positiva." });
  } else if (Math.abs(weightSum - 1) > 1e-6) {
    issues.push({
      level: "warning",
      message: `A soma dos pesos é ${weightSum.toFixed(2)} — serão normalizados para 1 no cálculo.`,
    });
  }

  // --- matriz ---
  const cellInvalid = matrix.some(
    (row) => row.length !== criteria.length || row.some((v) => !Number.isFinite(v)),
  );
  if (cellInvalid)
    issues.push({ level: "error", message: "Toda célula da matriz deve ser um número válido." });

  const errors = issues.filter((it) => it.level === "error");
  const warnings = issues.filter((it) => it.level === "warning");
  const criterionErrors = new Set(
    errors.filter((it) => it.criterion !== undefined).map((it) => it.criterion as number),
  );

  return { issues, errors, warnings, criterionErrors, ok: errors.length === 0 };
}
