"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Crown,
  Download,
  ListOrdered,
  Plus,
  X,
} from "lucide-react";
import {
  CriterionInput,
  PreferenceType,
  PREFERENCE_LABELS,
  PREFERENCE_PARAMS,
  ScaleTerm,
  SolveRequest,
  SolveResponse,
  exportFile,
  solve,
} from "@/lib/api";
import { TEMPLATES, type Problem } from "@/lib/templates";
import { validateProblem } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RankingChart } from "./components/RankingChart";
import { GaiaPlane } from "./components/GaiaPlane";
import { CriteriaWeightsChart } from "./components/CriteriaWeightsChart";
import { FlowQuadrantChart } from "./components/FlowQuadrantChart";
import { PreferenceHeatmap } from "./components/PreferenceHeatmap";
import { PreferenceFunctionChart } from "./components/PreferenceFunctionChart";
import { ProblemBar } from "./components/ProblemBar";
import { SensitivityPanel } from "./components/SensitivityPanel";
import { ScenarioComparison } from "./components/ScenarioComparison";

// Ponto de partida editável (também disponível como template).
const EXAMPLE: Problem = TEMPLATES[0].problem;

const PREFERENCE_TYPES = Object.keys(PREFERENCE_LABELS) as PreferenceType[];
const PARAM_KEYS = ["q", "p", "s"] as const;

export default function Home() {
  const [name, setName] = useState<string>(EXAMPLE.name);
  const [alternatives, setAlternatives] = useState<string[]>(EXAMPLE.alternatives);
  const [criteria, setCriteria] = useState<CriterionInput[]>(EXAMPLE.criteria);
  const [matrix, setMatrix] = useState<number[][]>(EXAMPLE.matrix);
  const [openScale, setOpenScale] = useState<number | null>(null);
  const [result, setResult] = useState<SolveResponse | null>(null);
  // Snapshot do problema que gerou `result` (pode divergir do estado editado).
  const [solvedProblem, setSolvedProblem] = useState<Problem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const weightSum = useMemo(
    () => criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0),
    [criteria],
  );

  // Estado atual como um Problem completo (para salvar/exportar/validar).
  const problem: Problem = { name, alternatives, criteria, matrix };

  // Validação guiada: erros bloqueantes e avisos calculados ao vivo.
  const validation = useMemo(() => validateProblem(problem), [problem]);

  function buildRequest(): SolveRequest {
    return { name, alternatives, criteria, matrix };
  }

  function loadProblem(p: Problem) {
    setName(p.name);
    setAlternatives(p.alternatives);
    setCriteria(p.criteria);
    setMatrix(p.matrix);
    setOpenScale(null);
    setResult(null);
    setSolvedProblem(null);
    setError(null);
  }

  async function handleSolve() {
    if (!validation.ok) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await solve(buildRequest()));
      setSolvedProblem(structuredClone(problem));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setResult(null);
      setSolvedProblem(null);
    } finally {
      setLoading(false);
    }
  }

  // --- mutações de estado -------------------------------------------------
  function updateCriterion(i: number, patch: Partial<CriterionInput>) {
    setCriteria((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }
  function addCriterion() {
    setCriteria((cs) => [
      ...cs,
      { name: `Critério ${cs.length + 1}`, weight: 1, maximize: true, preference: "usual" },
    ]);
    setMatrix((m) => m.map((row) => [...row, 0]));
  }
  function removeCriterion(i: number) {
    if (criteria.length <= 1) return;
    setCriteria((cs) => cs.filter((_, k) => k !== i));
    setMatrix((m) => m.map((row) => row.filter((_, k) => k !== i)));
  }
  function addAlternative() {
    setAlternatives((a) => [...a, `Alternativa ${a.length + 1}`]);
    setMatrix((m) => [...m, criteria.map(() => 0)]);
  }
  function removeAlternative(i: number) {
    if (alternatives.length <= 2) return;
    setAlternatives((a) => a.filter((_, k) => k !== i));
    setMatrix((m) => m.filter((_, k) => k !== i));
  }
  function updateCell(i: number, j: number, value: number) {
    setMatrix((m) => m.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? value : c)) : row)));
  }

  // --- escalas qualitativas (termos) --------------------------------------
  // Converte o critério j para qualitativo (cria escala padrão) ou volta a
  // numérico (remove a escala). Ao virar qualitativo, snapa a coluna ao 1º termo.
  function toggleQualitative(j: number, enabled: boolean) {
    if (enabled) {
      const scale: ScaleTerm[] = [
        { term: "Baixo", value: 1 },
        { term: "Médio", value: 2 },
        { term: "Alto", value: 3 },
      ];
      updateCriterion(j, { scale });
      setMatrix((m) => m.map((row) => row.map((c, ci) => (ci === j ? scale[0].value : c))));
    } else {
      updateCriterion(j, { scale: null });
    }
  }
  function updateTerm(j: number, t: number, patch: Partial<ScaleTerm>) {
    setCriteria((cs) =>
      cs.map((c, k) =>
        k === j && c.scale ? { ...c, scale: c.scale.map((s, ti) => (ti === t ? { ...s, ...patch } : s)) } : c,
      ),
    );
  }
  function addTerm(j: number) {
    setCriteria((cs) =>
      cs.map((c, k) => {
        if (k !== j || !c.scale) return c;
        const nextVal = c.scale.length ? Math.max(...c.scale.map((s) => s.value)) + 1 : 1;
        return { ...c, scale: [...c.scale, { term: `Termo ${c.scale.length + 1}`, value: nextVal }] };
      }),
    );
  }
  function removeTerm(j: number, t: number) {
    setCriteria((cs) =>
      cs.map((c, k) =>
        k === j && c.scale && c.scale.length > 1
          ? { ...c, scale: c.scale.filter((_, ti) => ti !== t) }
          : c,
      ),
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <header className="mb-10">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              PROMETHEE II
            </h1>
            <Badge variant="secondary" className="font-normal">
              MCDM · GAIA
            </Badge>
          </div>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Apoio à decisão multicritério com ranking completo e plano GAIA.
            Defina os critérios e a matriz de avaliação para calcular os fluxos
            φ⁺, φ⁻ e φ líquido.
          </p>
        </header>

        {/* ---------------- 0. Problema ---------------- */}
        <ProblemBar
          problem={problem}
          name={name}
          onNameChange={setName}
          onLoad={loadProblem}
        />

        {/* ---------------- 1. Critérios ---------------- */}
        <Card className="mb-6 [--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <StepMarker n={1} />
              Critérios
              <span className="tnum text-xs font-normal text-muted-foreground">
                Σ pesos {weightSum.toFixed(2)}
              </span>
            </CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" onClick={addCriterion}>
                <Plus /> Critério
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nome</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Objetivo</TableHead>
                    <TableHead>Função de preferência</TableHead>
                    <TableHead className="text-center">q</TableHead>
                    <TableHead className="text-center">p</TableHead>
                    <TableHead className="text-center">s</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c, i) => {
                    const params = PREFERENCE_PARAMS[c.preference];
                    const isQualitative = Array.isArray(c.scale);
                    const hasError = validation.criterionErrors.has(i);
                    return (
                      <Fragment key={i}>
                      <TableRow className={hasError ? "bg-destructive/5" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {hasError && (
                              <AlertTriangle
                                className="size-4 shrink-0 text-destructive"
                                aria-label="Critério com parâmetros inválidos"
                              />
                            )}
                            <Input
                              className="w-44"
                              value={c.name}
                              onChange={(e) => updateCriterion(i, { name: e.target.value })}
                            />
                            {isQualitative && (
                              <Badge variant="secondary" className="shrink-0 font-normal">
                                termos
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.05"
                            className="tnum w-20"
                            value={c.weight}
                            onChange={(e) => updateCriterion(i, { weight: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={c.maximize ? "max" : "min"}
                            onValueChange={(v) => updateCriterion(i, { maximize: v === "max" })}
                          >
                            <SelectTrigger className="w-[140px]" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="max">
                                <ArrowUp className="text-muted-foreground" /> Maximizar
                              </SelectItem>
                              <SelectItem value="min">
                                <ArrowDown className="text-muted-foreground" /> Minimizar
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={c.preference}
                            onValueChange={(v) => updateCriterion(i, { preference: v as PreferenceType })}
                          >
                            <SelectTrigger className="w-[230px]" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PREFERENCE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {PREFERENCE_LABELS[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {PARAM_KEYS.map((param) => (
                          <TableCell key={param}>
                            <Input
                              type="number"
                              step="0.5"
                              disabled={!params.includes(param)}
                              className="tnum mx-auto w-16 text-center"
                              value={(c[param] as number | null | undefined) ?? ""}
                              onChange={(e) =>
                                updateCriterion(i, {
                                  [param]: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={
                                isQualitative || openScale === i
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }
                              onClick={() => setOpenScale((o) => (o === i ? null : i))}
                              aria-label={`Escala qualitativa de ${c.name}`}
                              aria-pressed={openScale === i}
                            >
                              <ListOrdered />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeCriterion(i)}
                              aria-label={`Remover ${c.name}`}
                              disabled={criteria.length <= 1}
                            >
                              <X />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {openScale === i && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-muted/20">
                            <ScaleEditor
                              criterion={c}
                              onToggle={(enabled) => toggleQualitative(i, enabled)}
                              onTerm={(t, patch) => updateTerm(i, t, patch)}
                              onAdd={() => addTerm(i)}
                              onRemove={(t) => removeTerm(i, t)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ---------------- 2. Matriz de avaliação ---------------- */}
        <Card className="mb-6 [--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <StepMarker n={2} />
              Alternativas e avaliações
            </CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" onClick={addAlternative}>
                <Plus /> Alternativa
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Alternativa</TableHead>
                    {criteria.map((c, j) => (
                      <TableHead key={j} className="whitespace-nowrap">
                        {c.name}
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alternatives.map((name, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          className="w-44"
                          value={name}
                          onChange={(e) =>
                            setAlternatives((a) => a.map((n, k) => (k === i ? e.target.value : n)))
                          }
                        />
                      </TableCell>
                      {criteria.map((c, j) => (
                        <TableCell key={j}>
                          {c.scale ? (
                            <Select
                              value={String(matrix[i]?.[j] ?? c.scale[0]?.value ?? 0)}
                              onValueChange={(v) => updateCell(i, j, Number(v))}
                            >
                              <SelectTrigger className="w-32" size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {c.scale.map((t) => (
                                  <SelectItem key={t.value} value={String(t.value)}>
                                    {t.term}
                                    <span className="tnum ml-1.5 text-muted-foreground">({t.value})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type="number"
                              step="any"
                              className="tnum w-24"
                              value={matrix[i]?.[j] ?? 0}
                              onChange={(e) => updateCell(i, j, Number(e.target.value))}
                            />
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeAlternative(i)}
                          aria-label={`Remover ${name}`}
                          disabled={alternatives.length <= 2}
                        >
                          <X />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle>Distribuição dos pesos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CriteriaWeightsChart criteria={criteria} />
              <div className="grid grid-cols-3 gap-3">
                <MetricTile label="Critérios" value={criteria.length.toString()} />
                <MetricTile label="Alternativas" value={alternatives.length.toString()} />
                <MetricTile label="Σ pesos" value={weightSum.toFixed(2)} tone={weightSum > 0 ? "positive" : "warning"} />
              </div>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle>Arquitetura do modelo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {criteria.map((c) => (
                  <div key={c.name} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium leading-tight">{c.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.maximize ? "Maximizar" : "Minimizar"} · {PREFERENCE_LABELS[c.preference]}
                        </p>
                      </div>
                      <Badge variant="secondary" className="tnum shrink-0">
                        {Number(c.weight || 0).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Funções de preferência (limiares) ---------------- */}
        <Card className="mb-6 [--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle>Funções de preferência</CardTitle>
            <p className="text-sm text-muted-foreground">
              Grau de preferência P(d) em função do desvio d, com os limiares
              q e p marcados. Atualiza ao editar os parâmetros acima.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {criteria.map((c, i) => (
                <PreferenceFunctionChart key={i} criterion={c} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ---------------- Validação guiada ---------------- */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <ValidationSummary
            errors={validation.errors.map((e) => e.message)}
            warnings={validation.warnings.map((w) => w.message)}
          />
        )}

        <div className="mb-10 flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            onClick={handleSolve}
            disabled={loading || !validation.ok}
            className="px-6"
          >
            {loading ? "Calculando…" : "Calcular ranking"}
          </Button>
          {!validation.ok && (
            <p className="text-sm text-muted-foreground">
              Corrija os {validation.errors.length} erro(s) acima para calcular.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* ---------------- Resultados ---------------- */}
        {result && (
          <section key={result.scores.map((s) => s.name + s.phi_net).join()} className="ph-rise space-y-6">
            <ResultOverview result={result} />

            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle>Ranking · PROMETHEE II</CardTitle>
                <CardAction className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportFile("csv", buildRequest())}>
                    <Download /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportFile("pdf", buildRequest())}>
                    <Download /> PDF
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Alternativa</TableHead>
                          <TableHead className="text-right">φ⁺</TableHead>
                          <TableHead className="text-right">φ⁻</TableHead>
                          <TableHead className="text-right">φ líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...result.scores]
                          .sort((a, b) => a.rank - b.rank)
                          .map((s) => (
                            <TableRow
                              key={s.name}
                              className={s.rank === 1 ? "bg-accent/40" : undefined}
                            >
                              <TableCell>
                                <Badge
                                  variant={s.rank === 1 ? "default" : "secondary"}
                                  className="tnum h-6 w-6 justify-center rounded-md p-0"
                                >
                                  {s.rank}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  {s.name}
                                  {s.rank === 1 && (
                                    <Crown className="size-3.5 text-chart-3" aria-label="Melhor alternativa" />
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="tnum text-right text-muted-foreground">
                                {s.phi_plus.toFixed(4)}
                              </TableCell>
                              <TableCell className="tnum text-right text-muted-foreground">
                                {s.phi_minus.toFixed(4)}
                              </TableCell>
                              <TableCell
                                className={`tnum text-right font-medium ${
                                  s.phi_net >= 0 ? "text-primary" : "text-destructive"
                                }`}
                              >
                                {s.phi_net >= 0 ? "+" : ""}
                                {s.phi_net.toFixed(4)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="rounded-lg border bg-muted/10 p-4">
                    <h3 className="mb-3 text-sm font-medium">Diagnóstico dos fluxos</h3>
                    <FlowQuadrantChart scores={result.scores} />
                  </div>
                </div>

                <Separator />
                <RankingChart scores={result.scores} />
              </CardContent>
            </Card>

            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle>Preferência agregada</CardTitle>
              </CardHeader>
              <CardContent>
                <PreferenceHeatmap
                  alternatives={alternatives}
                  preferenceIndex={result.preference_index}
                />
              </CardContent>
            </Card>

            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle>Análise de sensibilidade dos pesos</CardTitle>
              </CardHeader>
              <CardContent>
                <SensitivityPanel
                  request={(() => {
                    const p = solvedProblem ?? problem;
                    return { name: p.name, alternatives: p.alternatives, criteria: p.criteria, matrix: p.matrix };
                  })()}
                />
              </CardContent>
            </Card>

            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle>Comparação de cenários</CardTitle>
              </CardHeader>
              <CardContent>
                <ScenarioComparison current={{ problem: solvedProblem ?? problem, result }} />
              </CardContent>
            </Card>

            {result.gaia && (
              <Card className="[--card-spacing:--spacing(5)]">
                <CardHeader>
                  <CardTitle>Plano GAIA</CardTitle>
                </CardHeader>
                <CardContent>
                  <GaiaPlane gaia={result.gaia} />
                </CardContent>
              </Card>
            )}
          </section>
        )}

        <footer className="mt-14 border-t pt-5 text-xs text-muted-foreground">
          Baseado em Brans &amp; Vincke (1986) e Behzadian et al. (2010).
        </footer>
      </main>
    </div>
  );
}

function StepMarker({ n }: { n: number }) {
  return (
    <span className="tnum inline-flex size-5 items-center justify-center rounded-md bg-secondary text-xs font-medium text-secondary-foreground">
      {n}
    </span>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "warning"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ResultOverview({ result }: { result: SolveResponse }) {
  const ordered = [...result.scores].sort((a, b) => a.rank - b.rank);
  const best = ordered[0];
  const runnerUp = ordered[1];
  const gap = best && runnerUp ? best.phi_net - runnerUp.phi_net : 0;
  const positiveCount = result.scores.filter((s) => s.phi_net >= 0).length;
  const gaiaQuality = result.gaia ? `${(result.gaia.quality * 100).toFixed(1)}%` : "-";

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Melhor compromisso"
        value={best?.name ?? "-"}
        detail={best ? `φ líquido ${formatSigned(best.phi_net)}` : "-"}
      />
      <MetricCard
        label="Folga para o 2º"
        value={formatSigned(gap)}
        detail={runnerUp ? `contra ${runnerUp.name}` : "-"}
      />
      <MetricCard
        label="Alternativas positivas"
        value={`${positiveCount}/${result.scores.length}`}
        detail="φ líquido maior ou igual a zero"
      />
      <MetricCard
        label="Qualidade GAIA"
        value={gaiaQuality}
        detail="variância preservada no plano"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(4)]">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-xl font-semibold tracking-tight">{value}</p>
        <p className="tnum mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function ValidationSummary({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  return (
    <div className="mb-6 space-y-3">
      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" />
            {errors.length === 1 ? "1 problema impede o cálculo" : `${errors.length} problemas impedem o cálculo`}
          </p>
          <ul className="ml-6 list-disc space-y-0.5 text-sm text-destructive/90">
            {errors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-chart-3/40 bg-chart-3/5 p-4">
          <ul className="ml-6 list-disc space-y-0.5 text-sm text-muted-foreground">
            {warnings.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScaleEditor({
  criterion,
  onToggle,
  onTerm,
  onAdd,
  onRemove,
}: {
  criterion: CriterionInput;
  onToggle: (enabled: boolean) => void;
  onTerm: (index: number, patch: Partial<ScaleTerm>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const scale = criterion.scale;

  if (!scale) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <p className="max-w-[60ch] text-sm text-muted-foreground">
          Critério numérico. Você pode usar <strong>termos qualitativos</strong>{" "}
          (ex.: ruim/regular/bom/ótimo) mapeados a notas — o sistema calcula sobre
          as notas.
        </p>
        <Button variant="outline" size="sm" onClick={() => onToggle(true)}>
          <ListOrdered /> Usar termos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">Termos qualitativos</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onToggle(false)}
        >
          Voltar a numérico
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {scale.map((t, ti) => (
          <div key={ti} className="flex items-center gap-1 rounded-md border bg-card p-1.5">
            <Input
              className="w-28"
              value={t.term}
              placeholder="Termo"
              onChange={(e) => onTerm(ti, { term: e.target.value })}
            />
            <Input
              type="number"
              step="any"
              className="tnum w-16"
              value={t.value}
              onChange={(e) => onTerm(ti, { value: Number(e.target.value) })}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(ti)}
              disabled={scale.length <= 1}
              aria-label="Remover termo"
            >
              <X />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Termo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O valor numérico de cada termo é o que entra no cálculo. Defina os
        limiares q/p na mesma escala dos valores.
      </p>
    </div>
  );
}
