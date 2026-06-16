"use client";

import {
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ScoreOutput } from "@/lib/api";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  flow: { label: "Fluxos" },
} satisfies ChartConfig;

export function FlowQuadrantChart({ scores }: { scores: ScoreOutput[] }) {
  const data = scores.map((s) => ({
    name: s.name,
    rank: s.rank,
    phiPlus: Number(s.phi_plus.toFixed(4)),
    phiMinus: Number(s.phi_minus.toFixed(4)),
    net: Number(s.phi_net.toFixed(4)),
  }));
  const maxFlow = Math.max(
    0.01,
    ...data.flatMap((s) => [Math.abs(s.phiPlus), Math.abs(s.phiMinus)]),
  );
  const domain: [number, number] = [0, Math.ceil(maxFlow * 12) / 10];

  return (
    <ChartContainer config={config} className="h-72 w-full">
      <ScatterChart margin={{ top: 16, right: 28, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="phiPlus"
          name="φ+"
          domain={domain}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="tnum"
          label={{
            value: "φ+ superação",
            position: "insideBottom",
            offset: -12,
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="phiMinus"
          name="φ-"
          domain={domain}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="tnum"
          label={{
            value: "φ- superado",
            angle: -90,
            position: "insideLeft",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <ZAxis type="number" dataKey="rank" range={[150, 150]} />
        <ReferenceLine
          segment={[
            { x: domain[0], y: domain[0] },
            { x: domain[1], y: domain[1] },
          ]}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as {
              name: string;
              rank: number;
              phiPlus: number;
              phiMinus: number;
              net: number;
            };

            return (
              <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                <span className="font-medium text-foreground">
                  #{point.rank} {point.name}
                </span>
                <span className="tnum text-muted-foreground">
                  φ+ {point.phiPlus.toFixed(4)}
                </span>
                <span className="tnum text-muted-foreground">
                  φ- {point.phiMinus.toFixed(4)}
                </span>
                <span className="tnum text-muted-foreground">
                  φ líquido {point.net >= 0 ? "+" : ""}
                  {point.net.toFixed(4)}
                </span>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={d.net >= 0 ? "var(--chart-1)" : "var(--chart-4)"}
            />
          ))}
          <LabelList
            dataKey="name"
            position="top"
            offset={8}
            fontSize={11}
            className="fill-foreground"
          />
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}
