"use client";

import { useState } from "react";

/**
 * Single-series column chart: one hue (magnitude), 4px rounded data-ends on the
 * baseline, 2px gaps, recessive grid, per-bar hover/focus tooltip with a
 * hit target taller than the mark, and a visually-hidden table for screen readers.
 */
export default function BarChart({ data, unit, label, height = 140 }: { data: { x: string; y: number }[]; unit: string; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.y));
  const w = 100 / data.length;
  return (
    <figure className="relative">
      <figcaption className="sr-only">{label}</figcaption>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
        {[0.5, 1].map((g) => (
          <line key={g} x1="0" x2="100" y1={(height / 3) * (1 - g)} y2={(height / 3) * (1 - g)} stroke="var(--color-line)" strokeWidth=".15" />
        ))}
        {data.map((d, i) => {
          const h = Math.max(d.y > 0 ? 1.2 : 0, (d.y / max) * (height / 3 - 2));
          return (
            <g key={d.x}>
              <rect x={i * w + 0.4} width={w - 0.8} y={height / 3 - h} height={h} rx="0.9" fill={hover === i ? "var(--color-brand-2)" : "var(--color-brand)"} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex">
        {data.map((d, i) => (
          <button
            key={d.x}
            className="h-full flex-1 focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.x}: ${d.y} ${unit}`}
          />
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel px-2.5 py-1 text-xs shadow-lg" style={{ left: `${(hover + 0.5) * w}%` }}>
          <span className="text-muted">{data[hover].x}</span> · <b>{data[hover].y}</b> {unit}
        </div>
      )}
      <div className="mt-1 flex text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={d.x} className="flex-1 text-center">{data.length <= 10 || i % 5 === 0 ? d.x : ""}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}><th>{d.x}</th><td>{d.y} {unit}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
