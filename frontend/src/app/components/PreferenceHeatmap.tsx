"use client";

export function PreferenceHeatmap({
  alternatives,
  preferenceIndex,
}: {
  alternatives: string[];
  preferenceIndex: number[][];
}) {
  const values = preferenceIndex.flatMap((row, i) =>
    row.filter((_, j) => i !== j),
  );
  const max = Math.max(0.01, ...values);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[520px] gap-px rounded-lg border bg-border p-px"
        style={{
          gridTemplateColumns: `minmax(8rem,1.2fr) repeat(${alternatives.length}, minmax(4.25rem,1fr))`,
        }}
      >
        <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          Preferência
        </div>
        {alternatives.map((name) => (
          <div
            key={`head-${name}`}
            className="bg-muted px-3 py-2 text-right text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
        {preferenceIndex.map((row, i) => (
          <Row
            key={alternatives[i] ?? i}
            row={row}
            rowName={alternatives[i] ?? `Alt. ${i + 1}`}
            rowIndex={i}
            max={max}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  rowName,
  rowIndex,
  max,
}: {
  row: number[];
  rowName: string;
  rowIndex: number;
  max: number;
}) {
  return (
    <>
      <div className="bg-card px-3 py-2 text-xs font-medium">{rowName}</div>
      {row.map((value, j) => {
        const isDiagonal = rowIndex === j;
        const intensity = isDiagonal ? 0 : Math.max(0.08, value / max);
        return (
          <div
            key={`${rowIndex}-${j}`}
            className="tnum relative bg-card px-3 py-2 text-right text-xs"
            title={
              isDiagonal
                ? "Comparação própria"
                : `${rowName} sobre alternativa ${j + 1}: ${value.toFixed(4)}`
            }
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background: isDiagonal
                  ? "repeating-linear-gradient(135deg, transparent 0 6px, var(--muted) 6px 7px)"
                  : `color-mix(in oklch, var(--chart-1) ${Math.round(
                      intensity * 72,
                    )}%, transparent)`,
              }}
            />
            <span className="relative">
              {isDiagonal ? "-" : value.toFixed(3)}
            </span>
          </div>
        );
      })}
    </>
  );
}
