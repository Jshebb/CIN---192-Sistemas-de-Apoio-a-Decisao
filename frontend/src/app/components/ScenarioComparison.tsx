"use client";

import { useState } from "react";
import { CameraOff, Crown, Plus, X } from "lucide-react";
import type { SolveResponse } from "@/lib/api";
import type { Problem } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Scenario {
  id: string;
  label: string;
  problem: Problem;
  result: SolveResponse;
}

interface Props {
  // Estado atual já resolvido (null enquanto não houver ranking calculado).
  current: { problem: Problem; result: SolveResponse } | null;
}

// Resumo curto dos pesos normalizados de um cenário, p/ explicar a diferença.
function weightsSummary(p: Problem): string {
  const total = p.criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 1;
  return p.criteria
    .map((c) => `${c.name.split(" ")[0]} ${((Number(c.weight) || 0) / total).toFixed(2)}`)
    .join(" · ");
}

export function ScenarioComparison({ current }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  function capture() {
    if (!current) return;
    setScenarios((s) => [
      ...s,
      {
        id: `${Date.now()}-${s.length}`,
        label: current.problem.name?.trim() || `Cenário ${s.length + 1}`,
        problem: structuredClone(current.problem),
        result: current.result,
      },
    ]);
  }
  function remove(id: string) {
    setScenarios((s) => s.filter((sc) => sc.id !== id));
  }

  // União das alternativas (preservando a ordem do 1º cenário).
  const altNames: string[] = [];
  for (const sc of scenarios)
    for (const s of sc.result.scores) if (!altNames.includes(s.name)) altNames.push(s.name);

  function cell(sc: Scenario, name: string) {
    return sc.result.scores.find((s) => s.name === name) ?? null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-sm text-muted-foreground">
          Capture o resultado atual, ajuste pesos/parâmetros, recalcule e capture
          de novo para comparar os rankings lado a lado.
        </p>
        <Button variant="outline" size="sm" onClick={capture} disabled={!current}>
          <Plus /> Capturar cenário atual
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          <CameraOff className="size-4 shrink-0" />
          Nenhum cenário capturado ainda. Calcule um ranking e clique em
          “Capturar cenário atual”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Alternativa</TableHead>
                {scenarios.map((sc) => (
                  <TableHead key={sc.id} className="min-w-[11rem]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{sc.label}</p>
                        <p className="text-[11px] font-normal text-muted-foreground">
                          {weightsSummary(sc.problem)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(sc.id)}
                        aria-label={`Remover ${sc.label}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {altNames.map((name) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  {scenarios.map((sc) => {
                    const s = cell(sc, name);
                    if (!s)
                      return (
                        <TableCell key={sc.id} className="text-muted-foreground">
                          —
                        </TableCell>
                      );
                    return (
                      <TableCell key={sc.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={s.rank === 1 ? "default" : "secondary"}
                            className="tnum h-6 w-6 justify-center rounded-md p-0"
                          >
                            {s.rank}
                          </Badge>
                          <span
                            className={`tnum text-xs ${
                              s.phi_net >= 0 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {s.phi_net >= 0 ? "+" : ""}
                            {s.phi_net.toFixed(3)}
                          </span>
                          {s.rank === 1 && <Crown className="size-3.5 text-chart-3" />}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
