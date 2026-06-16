"use client";

import type { CriterionInput } from "@/lib/api";

export function CriteriaWeightsChart({ criteria }: { criteria: CriterionInput[] }) {
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
  const maxWeight = Math.max(0.01, ...criteria.map((c) => Number(c.weight) || 0));

  return (
    <div className="space-y-3">
      {criteria.map((c) => {
        const weight = Number(c.weight) || 0;
        const share = total > 0 ? weight / total : 0;
        const width = `${Math.max(4, (weight / maxWeight) * 100)}%`;

        return (
          <div key={c.name} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-muted-foreground">{c.name}</span>
              <span className="tnum shrink-0 text-foreground">
                {weight.toFixed(2)} · {(share * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width }}
                aria-label={`${c.name}: peso ${weight.toFixed(2)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
