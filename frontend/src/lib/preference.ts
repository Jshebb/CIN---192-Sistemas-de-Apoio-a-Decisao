// Avaliação das funções de preferência P(d) no frontend, para visualizar os
// limiares. Espelha backend/app/core/preference_functions.py.
//
// d = diferença orientada para maximização; P(d) ∈ [0, 1], P(d) = 0 p/ d ≤ 0.

import type { CriterionInput, PreferenceType } from "@/lib/api";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function evaluatePreference(
  d: number,
  preference: PreferenceType,
  q?: number | null,
  p?: number | null,
  s?: number | null,
): number {
  if (d <= 0) return 0;
  switch (preference) {
    case "usual":
      return 1;
    case "u_shape":
      return d > (q ?? 0) ? 1 : 0;
    case "v_shape":
      return p && p > 0 ? clamp01(d / p) : 0;
    case "level": {
      const qq = q ?? 0;
      const pp = p ?? qq;
      if (d > pp) return 1;
      if (d > qq) return 0.5;
      return 0;
    }
    case "linear": {
      const qq = q ?? 0;
      const pp = p ?? qq;
      if (pp <= qq) return d > qq ? 1 : 0;
      return d > qq ? clamp01((d - qq) / (pp - qq)) : 0;
    }
    case "gaussian":
      return s && s > 0 ? 1 - Math.exp(-(d * d) / (2 * s * s)) : 0;
    default:
      return 0;
  }
}

export interface PreferenceSample {
  d: number;
  p: number;
}

// Amostra P(d) num domínio razoável para o critério, escolhido a partir dos
// limiares (q/p/s). Densa o bastante para que degraus apareçam quase verticais.
export function samplePreference(c: CriterionInput, points = 160): PreferenceSample[] {
  const scale = Math.max(c.q ?? 0, c.p ?? 0, (c.s ?? 0) * 2, 0);
  const dMax = scale > 0 ? scale * 1.6 : 1;
  const out: PreferenceSample[] = [];
  for (let i = 0; i <= points; i++) {
    const d = (dMax * i) / points;
    out.push({ d, p: evaluatePreference(d, c.preference, c.q, c.p, c.s) });
  }
  return out;
}
