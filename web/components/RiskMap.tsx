"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { Country } from "@/lib/types";

const W = 820;
const H = 430;

// Risk 0 (safe, green) -> 100 (risk, red), via yellow. Returns an HSL string.
function colorFor(score: number | undefined): string {
  if (score === undefined || score === null || Number.isNaN(score)) return "#2A2E37";
  const s = Math.max(0, Math.min(100, score));
  const hue = 120 - (s / 100) * 120; // 120=green -> 0=red
  return `hsl(${hue}, 65%, 45%)`;
}

interface GeoShape {
  d: string;
  iso: string | null;
  name: string;
}

export default function RiskMap({
  rows,
  minRisk,
  selectedIso,
  onSelect,
}: {
  rows: Country[];
  minRisk: number;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
}) {
  const [shapes, setShapes] = useState<GeoShape[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/countries-110m.json").then((r) => r.json()),
      fetch("/ccn3-to-cca3.json").then((r) => r.json()),
    ])
      .then(([topo, lookup]: [any, Record<string, string>]) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as {
          features: Feature<Geometry, { name?: string }>[];
        };
        const projection = geoNaturalEarth1().fitSize([W, H], fc as any);
        const path = geoPath(projection);
        const built: GeoShape[] = fc.features.map((f) => {
          const id = (f as any).id;
          const iso = id != null ? lookup[String(parseInt(String(id), 10))] ?? null : null;
          return { d: path(f) || "", iso, name: f.properties?.name ?? "" };
        });
        setShapes(built);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.risk_score >= minRisk) m.set(r.iso_code, r.risk_score);
    }
    return m;
  }, [rows, minRisk]);

  const ratingByIso = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.iso_code, r.risk_rating);
    return m;
  }, [rows]);

  if (error) {
    return <div className="text-sm text-red-400">地图加载失败 / Map failed: {error}</div>;
  }
  if (!shapes) {
    return <div className="text-sm text-gray-400 animate-pulse">加载地图… / Loading map…</div>;
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="World risk choropleth">
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
        {shapes.map((s, i) => {
          const score = s.iso ? scoreByIso.get(s.iso) : undefined;
          const isSel = s.iso !== null && s.iso === selectedIso;
          return (
            <path
              key={i}
              d={s.d}
              fill={colorFor(score)}
              stroke={isSel ? "#fff" : "#0E1117"}
              strokeWidth={isSel ? 1.4 : 0.4}
              className={s.iso && scoreByIso.has(s.iso) ? "cursor-pointer" : ""}
              onClick={() => s.iso && scoreByIso.has(s.iso) && onSelect(s.iso)}
              onMouseMove={(e) => {
                const rect = wrapRef.current?.getBoundingClientRect();
                const rating = s.iso ? ratingByIso.get(s.iso) : undefined;
                const txt =
                  score !== undefined
                    ? `${s.name} · ${score} (${rating ?? "NR"})`
                    : `${s.name} · 无数据 / no data`;
                setHover({
                  x: e.clientX - (rect?.left ?? 0),
                  y: e.clientY - (rect?.top ?? 0),
                  text: txt,
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded bg-black/85 px-2 py-1 text-xs text-white shadow"
          style={{ left: hover.x + 10, top: hover.y + 10 }}
        >
          {hover.text}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span>低风险 / low</span>
        <div className="h-2 w-40 rounded" style={{ background: "linear-gradient(90deg, hsl(120,65%,45%), hsl(60,65%,45%), hsl(0,65%,45%))" }} />
        <span>高风险 / high</span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#2A2E37" }} /> 无数据 / no data
        </span>
      </div>
    </div>
  );
}
