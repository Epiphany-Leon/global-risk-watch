"use client";

import { useMemo, useState } from "react";
import { Country } from "@/lib/types";

type NumKey =
  | "risk_score"
  | "inflation_rate"
  | "external_debt_gni_pct"
  | "gdp_billion_usd"
  | "population_million"
  | "unemployment_rate";

type SortKey = NumKey | "country";

function ratingClass(rating: string): string {
  if (rating.startsWith("A")) return "text-emerald-600 dark:text-emerald-400";
  if (rating.startsWith("B")) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

// Per-column bar color (CSS so it adapts to nothing — these read on both themes).
const BAR_COLOR: Record<NumKey, string> = {
  risk_score: "rgb(var(--accent))",
  inflation_rate: "#f59e0b",
  external_debt_gni_pct: "#8b5cf6",
  gdp_billion_usd: "#38bdf8",
  population_million: "#22c55e",
  unemployment_rate: "#fb923c",
};

// A numeric cell rendered as text + a horizontal data bar normalized to the
// column's max across the visible rows.
function BarCell({
  value,
  max,
  color,
  digits = 0,
}: {
  value: number | null | undefined;
  max: number;
  color: string;
  digits?: number;
}) {
  const has = typeof value === "number" && !Number.isNaN(value);
  // Clamp to [0, 100] so negative metrics (e.g. deflation) never emit an
  // invalid negative CSS width that silently collapses the bar.
  const pct = has && max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <td className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-edge/70">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="w-12 shrink-0 text-right tabular-nums">{fmt(value, digits)}</span>
      </div>
    </td>
  );
}

export default function DataTable({
  rows,
  selectedIso,
  onSelect,
}: {
  rows: Country[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [asc, setAsc] = useState(false);

  // Column maxima for bar normalization.
  const maxes = useMemo(() => {
    const keys: NumKey[] = [
      "risk_score",
      "inflation_rate",
      "external_debt_gni_pct",
      "gdp_billion_usd",
      "population_million",
      "unemployment_rate",
    ];
    const m = {} as Record<NumKey, number>;
    for (const k of keys) {
      m[k] = rows.reduce((acc, r) => {
        const v = r[k];
        return typeof v === "number" && !Number.isNaN(v) ? Math.max(acc, v) : acc;
      }, 0);
    }
    return m;
  }, [rows]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return (asc ? 1 : -1) * String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return (asc ? 1 : -1) * (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity));
    });
  }, [rows, sortKey, asc]);

  const head = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-2 py-1.5 text-left font-medium hover:text-fg"
      onClick={() => {
        if (sortKey === key) setAsc(!asc);
        else {
          setSortKey(key);
          setAsc(false);
        }
      }}
    >
      {label}
      {sortKey === key ? (asc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="max-h-[430px] overflow-auto rounded-lg border border-edge">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="sticky top-0 z-10 bg-panel text-muted">
          <tr>
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium">ISO</th>
            {head("country", "国家")}
            {head("risk_score", "风险分")}
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium">评级</th>
            {head("inflation_rate", "通胀%")}
            {head("external_debt_gni_pct", "外债%")}
            {head("gdp_billion_usd", "GDP")}
            {head("population_million", "人口M")}
            {head("unemployment_rate", "失业%")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.iso_code}
              onClick={() => onSelect(r.iso_code)}
              className={`cursor-pointer border-t border-edge/60 ${
                r.iso_code === selectedIso ? "bg-hover/[0.12] hover:bg-hover/20" : "hover:bg-hover/10"
              }`}
            >
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-muted">{r.iso_code}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{r.country}</td>
              <BarCell value={r.risk_score} max={maxes.risk_score} color={BAR_COLOR.risk_score} />
              <td className={`px-2 py-1.5 font-semibold ${ratingClass(r.risk_rating)}`}>{r.risk_rating}</td>
              <BarCell value={r.inflation_rate} max={maxes.inflation_rate} color={BAR_COLOR.inflation_rate} digits={1} />
              <BarCell
                value={r.external_debt_gni_pct}
                max={maxes.external_debt_gni_pct}
                color={BAR_COLOR.external_debt_gni_pct}
                digits={1}
              />
              <BarCell value={r.gdp_billion_usd} max={maxes.gdp_billion_usd} color={BAR_COLOR.gdp_billion_usd} />
              <BarCell
                value={r.population_million}
                max={maxes.population_million}
                color={BAR_COLOR.population_million}
                digits={1}
              />
              <BarCell
                value={r.unemployment_rate}
                max={maxes.unemployment_rate}
                color={BAR_COLOR.unemployment_rate}
                digits={1}
              />
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2 py-6 text-center text-muted">
                当前过滤条件下没有国家 / No countries
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
