"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import {
  sensitivity,
  type CriterionStability,
  type SensitivityResponse,
  type SolveRequest,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Props {
  request: SolveRequest;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// Largura do intervalo de estabilidade do ranking completo, como "robustez".
function robustness(c: CriterionStability): number {
  return c.rank_upper - c.rank_lower;
}

function StabilityBar({ c }: { c: CriterionStability }) {
  const left = (x: number) => `${x * 100}%`;
  const width = (a: number, b: number) => `${Math.max(0, b - a) * 100}%`;
  const robust = robustness(c);
  const tone =
    robust >= 0.3 ? "bg-primary" : robust >= 0.12 ? "bg-chart-3" : "bg-destructive";

  return (
    <div className="grid grid-cols-[10rem_1fr_5rem] items-center gap-3">
      <span className="truncate text-sm font-medium" title={c.name}>
        {c.name}
      </span>
      <div className="relative h-6 rounded-md bg-muted">
        {/* janela em que o 1º colocado não muda (mais clara) */}
        <div
          className="absolute inset-y-0 rounded-md bg-primary/15"
          style={{ left: left(c.winner_lower), width: width(c.winner_lower, c.winner_upper) }}
        />
        {/* janela em que o ranking completo não muda (mais forte) */}
        <div
          className={`absolute inset-y-1 rounded-sm ${tone} opacity-70`}
          style={{ left: left(c.rank_lower), width: width(c.rank_lower, c.rank_upper) }}
        />
        {/* marcador do peso atual */}
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: left(c.weight) }}
          title={`Peso atual ${pct(c.weight)}`}
        />
      </div>
      <span className="tnum text-right text-xs text-muted-foreground">
        ±{pct(Math.min(c.weight - c.rank_lower, c.rank_upper - c.weight))}
      </span>
    </div>
  );
}

export function SensitivityPanel({ request }: Props) {
  const [data, setData] = useState<SensitivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setData(await sensitivity(request));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na análise.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-sm text-muted-foreground">
          Quanto cada peso pode variar (mantendo a proporção dos demais) sem
          alterar o resultado. Barra forte = ranking idêntico; faixa clara = mesmo
          1º colocado; traço = peso atual.
        </p>
        <Button variant="outline" size="sm" onClick={run} disabled={loading}>
          <Activity /> {loading ? "Analisando…" : data ? "Recalcular" : "Analisar"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-2.5">
          {data.criteria.map((c) => (
            <StabilityBar key={c.name} c={c} />
          ))}
          <p className="border-t pt-3 text-xs text-muted-foreground">
            A coluna à direita mostra a margem mínima (para cima ou para baixo) do
            peso antes de o ranking mudar. Margens pequenas indicam critérios cujo
            peso é determinante — vale revisar com cuidado.
          </p>
        </div>
      )}
    </div>
  );
}
