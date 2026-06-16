"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { CriterionInput } from "@/lib/api";
import { PREFERENCE_LABELS } from "@/lib/api";
import { samplePreference } from "@/lib/preference";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  p: { label: "P(d)", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Visualiza a função de preferência de um critério: P(d) ∈ [0,1] em função do
// desvio d, com linhas de referência nos limiares q e p.
export function PreferenceFunctionChart({ criterion }: { criterion: CriterionInput }) {
  const data = samplePreference(criterion);
  const hasQ = criterion.q != null && ["u_shape", "level", "linear"].includes(criterion.preference);
  const hasP = criterion.p != null && ["v_shape", "level", "linear"].includes(criterion.preference);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium">{criterion.name}</p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {PREFERENCE_LABELS[criterion.preference]}
        </span>
      </div>
      <ChartContainer config={config} className="h-32 w-full">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="d"
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.5, 1]}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fontSize: 10 }}
            className="tnum"
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.d as number | undefined;
                  return `d = ${typeof d === "number" ? d.toFixed(2) : "?"}`;
                }}
                formatter={(v) => (v as number).toFixed(3)}
              />
            }
          />
          {hasQ && (
            <ReferenceLine
              x={criterion.q ?? undefined}
              stroke="var(--chart-3)"
              strokeDasharray="4 3"
              label={{ value: "q", position: "insideTopLeft", fontSize: 10, fill: "var(--chart-3)" }}
            />
          )}
          {hasP && (
            <ReferenceLine
              x={criterion.p ?? undefined}
              stroke="var(--chart-4)"
              strokeDasharray="4 3"
              label={{ value: "p", position: "insideTopRight", fontSize: 10, fill: "var(--chart-4)" }}
            />
          )}
          <Area
            dataKey="p"
            type="linear"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
