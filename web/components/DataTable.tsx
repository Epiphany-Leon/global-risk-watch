"use client";

import { useState } from "react";
import { Country } from "@/lib/types";

type SortKey = "risk_score" | "country" | "inflation_rate" | "external_debt_gni_pct";

function ratingClass(rating: string): string {
  if (rating.startsWith("A")) return "text-emerald-400";
  if (rating.startsWith("B")) return "text-amber-400";
  return "text-red-400";
}

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? "—" : String(v);
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

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" || typeof bv === "string") {
      return (asc ? 1 : -1) * String(av ?? "").localeCompare(String(bv ?? ""));
    }
    return (asc ? 1 : -1) * (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity));
  });

  const head = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none px-2 py-1.5 text-left font-medium hover:text-white"
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
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel text-gray-400">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">ISO</th>
            {head("country", "国家")}
            {head("risk_score", "风险分")}
            <th className="px-2 py-1.5 text-left font-medium">评级</th>
            {head("inflation_rate", "通胀%")}
            {head("external_debt_gni_pct", "外债%")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.iso_code}
              onClick={() => onSelect(r.iso_code)}
              className={`cursor-pointer border-t border-edge/60 hover:bg-white/5 ${
                r.iso_code === selectedIso ? "bg-white/10" : ""
              }`}
            >
              <td className="px-2 py-1.5 font-mono text-gray-300">{r.iso_code}</td>
              <td className="px-2 py-1.5">{r.country}</td>
              <td className="px-2 py-1.5 font-semibold">{r.risk_score}</td>
              <td className={`px-2 py-1.5 font-semibold ${ratingClass(r.risk_rating)}`}>{r.risk_rating}</td>
              <td className="px-2 py-1.5">{fmt(r.inflation_rate)}</td>
              <td className="px-2 py-1.5">{fmt(r.external_debt_gni_pct)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-6 text-center text-gray-500">
                当前过滤条件下没有国家 / No countries
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
