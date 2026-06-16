"use client";

import type { GaiaOutput } from "@/lib/api";

type PlotPoint = {
  name: string;
  x: number;
  y: number;
};

const WIDTH = 1000;
const HEIGHT = 430;
const PAD_X = 62;
const PAD_Y = 40;

// The GAIA biplot is easier to make legible as SVG than as generic Recharts
// primitives: vector arrowheads, label chips, halos, and symmetric domains are
// core to reading it.
export function GaiaPlane({ gaia }: { gaia: GaiaOutput }) {
  const altPoints = gaia.alternatives.map((a) => ({ ...a }));

  const maxAlt = Math.max(
    1e-6,
    ...altPoints.flatMap((a) => [Math.abs(a.x), Math.abs(a.y)]),
  );
  const maxCrit = Math.max(
    1e-6,
    ...gaia.criteria.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]),
  );
  const scale = (maxAlt / maxCrit) * 0.82;

  const criteriaScaled = gaia.criteria.map((c) => ({
    ...c,
    x: c.x * scale,
    y: c.y * scale,
  }));
  const pi = {
    name: "π",
    x: gaia.decision_axis.x * scale,
    y: gaia.decision_axis.y * scale,
  };

  const extent =
    Math.max(
      ...altPoints.flatMap((a) => [Math.abs(a.x), Math.abs(a.y)]),
      ...criteriaScaled.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]),
      Math.abs(pi.x),
      Math.abs(pi.y),
      1e-6,
    ) * 1.18;

  const project = (point: Pick<PlotPoint, "x" | "y">) => ({
    x: PAD_X + ((point.x + extent) / (extent * 2)) * (WIDTH - PAD_X * 2),
    y: PAD_Y + ((extent - point.y) / (extent * 2)) * (HEIGHT - PAD_Y * 2),
  });

  const origin = project({ x: 0, y: 0 });
  const quality = Math.max(0, Math.min(1, gaia.quality));
  const orderedCriteria = [...criteriaScaled].sort(
    (a, b) => vectorLength(b) - vectorLength(a),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Qualidade do plano (δ)
            <span className="tnum rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
              {(quality * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${quality * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <GaiaStat label="Alternativas" value={altPoints.length.toString()} />
          <GaiaStat label="Critérios" value={criteriaScaled.length.toString()} />
          <GaiaStat label="Escala" value={`${scale.toFixed(2)}x`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-muted/10">
        <svg
          role="img"
          aria-label="Plano GAIA com alternativas, vetores de critério e eixo de decisão"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block aspect-[1000/430] w-full"
        >
          <defs>
            <marker
              id="gaia-criterion-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6.2"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--chart-2)" />
            </marker>
            <marker
              id="gaia-pi-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--chart-3)" />
            </marker>
            <filter id="gaia-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="5" stdDeviation="6" floodOpacity="0.22" />
            </filter>
          </defs>

          <rect
            x={PAD_X}
            y={PAD_Y}
            width={WIDTH - PAD_X * 2}
            height={HEIGHT - PAD_Y * 2}
            rx="10"
            fill="var(--card)"
            opacity="0.34"
          />

          <GridLines project={project} extent={extent} />

          <line
            x1={origin.x}
            y1={PAD_Y}
            x2={origin.x}
            y2={HEIGHT - PAD_Y}
            stroke="var(--border)"
            strokeWidth="1.1"
          />
          <line
            x1={PAD_X}
            y1={origin.y}
            x2={WIDTH - PAD_X}
            y2={origin.y}
            stroke="var(--border)"
            strokeWidth="1.1"
          />
          <circle cx={origin.x} cy={origin.y} r="3" fill="var(--border)" />

          {orderedCriteria.map((criterion) => (
            <CriterionVector
              key={criterion.name}
              criterion={criterion}
              origin={origin}
              end={project(criterion)}
            />
          ))}

          <DecisionAxis origin={origin} end={project(pi)} />

          {altPoints.map((point, index) => (
            <AlternativePoint
              key={point.name}
              point={point}
              screen={project(point)}
              index={index}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
          <Legend swatch="var(--chart-1)" shape="dot">
            Alternativas
          </Legend>
          <Legend swatch="var(--chart-2)" shape="line">
            Vetores de critério
          </Legend>
          <Legend swatch="var(--chart-3)" shape="line">
            Eixo de decisão π
          </Legend>
        </dl>
        <p className="text-xs text-muted-foreground">
          Vetores mais longos indicam maior contribuição no plano projetado.
        </p>
      </div>
    </div>
  );
}

function GridLines({
  project,
  extent,
}: {
  project: (point: Pick<PlotPoint, "x" | "y">) => { x: number; y: number };
  extent: number;
}) {
  const ticks = [-0.5, 0, 0.5].map((ratio) => ratio * extent);

  return (
    <g opacity="0.72">
      {ticks.map((tick) => {
        const vertical = project({ x: tick, y: 0 }).x;
        const horizontal = project({ x: 0, y: tick }).y;
        return (
          <g key={tick}>
            <line
              x1={vertical}
              y1={PAD_Y}
              x2={vertical}
              y2={HEIGHT - PAD_Y}
              stroke="var(--border)"
              strokeDasharray={tick === 0 ? "0" : "4 8"}
              opacity={tick === 0 ? 0 : 0.8}
            />
            <line
              x1={PAD_X}
              y1={horizontal}
              x2={WIDTH - PAD_X}
              y2={horizontal}
              stroke="var(--border)"
              strokeDasharray={tick === 0 ? "0" : "4 8"}
              opacity={tick === 0 ? 0 : 0.8}
            />
          </g>
        );
      })}
    </g>
  );
}

function CriterionVector({
  criterion,
  origin,
  end,
}: {
  criterion: PlotPoint;
  origin: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const label = vectorLabel(end, origin, 16);

  return (
    <g>
      <line
        x1={origin.x}
        y1={origin.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--chart-2)"
        strokeWidth="2"
        markerEnd="url(#gaia-criterion-arrow)"
        opacity="0.9"
      />
      <SvgLabel
        x={label.x}
        y={label.y}
        text={criterion.name}
        color="var(--chart-2)"
        anchor={label.anchor}
      />
    </g>
  );
}

function DecisionAxis({
  origin,
  end,
}: {
  origin: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const label = vectorLabel(end, origin, 18);

  return (
    <g filter="url(#gaia-soft-shadow)">
      <line
        x1={origin.x}
        y1={origin.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--chart-3)"
        strokeWidth="3.5"
        markerEnd="url(#gaia-pi-arrow)"
      />
      <SvgLabel
        x={label.x}
        y={label.y}
        text="π melhor compromisso"
        color="var(--chart-3)"
        anchor={label.anchor}
      />
    </g>
  );
}

function AlternativePoint({
  point,
  screen,
  index,
}: {
  point: PlotPoint;
  screen: { x: number; y: number };
  index: number;
}) {
  const offsetY = index % 2 === 0 ? -18 : 24;
  const anchor = screen.x > WIDTH * 0.72 ? "end" : screen.x < WIDTH * 0.28 ? "start" : "middle";
  const labelX = anchor === "end" ? screen.x - 10 : anchor === "start" ? screen.x + 10 : screen.x;

  return (
    <g>
      <circle cx={screen.x} cy={screen.y} r="10" fill="var(--chart-1)" opacity="0.16" />
      <circle
        cx={screen.x}
        cy={screen.y}
        r="4.8"
        fill="var(--chart-1)"
        stroke="var(--card)"
        strokeWidth="2"
      />
      <SvgLabel
        x={labelX}
        y={screen.y + offsetY}
        text={point.name}
        color="var(--foreground)"
        anchor={anchor}
        muted
      />
    </g>
  );
}

function SvgLabel({
  x,
  y,
  text,
  color,
  anchor = "middle",
  muted = false,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  anchor?: "start" | "middle" | "end";
  muted?: boolean;
}) {
  const width = Math.max(48, text.length * 6.7 + 16);
  const rectX = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;

  return (
    <g>
      <rect
        x={rectX}
        y={y - 12}
        width={width}
        height="22"
        rx="7"
        fill="var(--card)"
        opacity={muted ? 0.72 : 0.88}
        stroke="var(--border)"
      />
      <text
        x={x}
        y={y + 3}
        textAnchor={anchor}
        fill={color}
        fontSize="12"
        fontWeight={muted ? 500 : 600}
      >
        {text}
      </text>
    </g>
  );
}

function GaiaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-[0.68rem] text-muted-foreground">{label}</p>
      <p className="tnum mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function Legend({
  swatch,
  shape,
  children,
}: {
  swatch: string;
  shape: "dot" | "line";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={shape === "dot" ? "size-2 rounded-full" : "h-0.5 w-4"}
        style={{ backgroundColor: swatch }}
      />
      {children}
    </div>
  );
}

function vectorLength(point: Pick<PlotPoint, "x" | "y">) {
  return Math.hypot(point.x, point.y);
}

function vectorLabel(
  end: { x: number; y: number },
  origin: { x: number; y: number },
  distance: number,
) {
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const x = end.x + (dx / length) * distance;
  const y = end.y + (dy / length) * distance;
  const anchor = dx > 18 ? "start" : dx < -18 ? "end" : "middle";

  return { x, y, anchor: anchor as "start" | "middle" | "end" };
}
