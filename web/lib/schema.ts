// Canonical schema + column mapping. Mirrors core/schema.py.
// Only iso_code and country are required; risk_score is derived when absent.
import { Country } from "./types";
import { computeRiskScore, getRiskRating, toNum } from "./riskModel";

export interface Field {
  key: string;
  label: string;
  required: boolean;
  kind: "id" | "text" | "num";
}

export const FIELDS: Field[] = [
  { key: "iso_code", label: "ISO-3 代码 / ISO-3 code", required: true, kind: "id" },
  { key: "country", label: "国家名称 / Country", required: true, kind: "text" },
  { key: "risk_score", label: "风险分 / Risk score", required: false, kind: "num" },
  { key: "risk_rating", label: "评级 / Rating", required: false, kind: "text" },
  { key: "inflation_rate", label: "通胀率 % / Inflation", required: false, kind: "num" },
  { key: "external_debt_gni_pct", label: "外债占GNI % / External debt", required: false, kind: "num" },
  { key: "unemployment_rate", label: "失业率 % / Unemployment", required: false, kind: "num" },
  { key: "gdp_billion_usd", label: "GDP 十亿美元 / GDP (B USD)", required: false, kind: "num" },
  { key: "population_million", label: "人口 百万 / Population (M)", required: false, kind: "num" },
  { key: "latitude", label: "纬度 / Latitude", required: false, kind: "num" },
  { key: "longitude", label: "经度 / Longitude", required: false, kind: "num" },
];

export const CANONICAL = FIELDS.map((f) => f.key);
export const REQUIRED = FIELDS.filter((f) => f.required).map((f) => f.key);

const ALIASES: Record<string, string[]> = {
  iso_code: ["iso_code", "iso", "iso3", "iso_a3", "cca3", "country_code", "code", "alpha3", "alpha_3"],
  country: ["country", "name", "country_name", "nation", "economy"],
  risk_score: ["risk_score", "score", "risk"],
  risk_rating: ["risk_rating", "rating", "grade"],
  inflation_rate: ["inflation_rate", "inflation", "cpi"],
  external_debt_gni_pct: ["external_debt_gni_pct", "external_debt", "debt_gni", "debt"],
  unemployment_rate: ["unemployment_rate", "unemployment", "jobless"],
  gdp_billion_usd: ["gdp_billion_usd", "gdp_billion", "gdp_usd", "gdp"],
  population_million: ["population_million", "population", "pop"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon", "lng", "long"],
};

export type Mapping = Record<string, string | null>;

export function autoMap(columns: string[]): Mapping {
  const lower = new Map<string, string>();
  for (const c of columns) lower.set(c.toLowerCase().trim(), c);
  const mapping: Mapping = {};
  for (const key of CANONICAL) {
    let found: string | null = null;
    for (const alias of ALIASES[key]) {
      if (lower.has(alias)) {
        found = lower.get(alias)!;
        break;
      }
    }
    mapping[key] = found;
  }
  return mapping;
}

export function normalize(rows: Record<string, unknown>[], mapping: Mapping): Country[] {
  const out: Country[] = [];
  for (const row of rows) {
    const rec: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const src = mapping[f.key];
      const raw = src ? row[src] : undefined;
      if (f.kind === "num") {
        rec[f.key] = toNum(raw);
      } else {
        rec[f.key] = raw === null || raw === undefined ? null : String(raw).trim();
      }
    }
    let iso = rec.iso_code as string | null;
    if (!iso) continue;
    iso = String(iso).trim().toUpperCase();
    if (iso.length !== 3) continue;
    rec.iso_code = iso;

    if (rec.risk_score === null || rec.risk_score === undefined) {
      rec.risk_score = computeRiskScore(rec);
    }
    if (!rec.risk_rating) {
      rec.risk_rating = getRiskRating(rec.risk_score as number);
    }
    out.push(rec as unknown as Country);
  }
  return out;
}

export function missingRequired(rows: Country[]): string[] {
  if (rows.length === 0) return REQUIRED;
  const bad: string[] = [];
  for (const key of REQUIRED) {
    const allEmpty = rows.every((r) => {
      const v = (r as unknown as Record<string, unknown>)[key];
      return v === null || v === undefined || v === "";
    });
    if (allEmpty) bad.push(key);
  }
  return bad;
}

export function labelFor(key: string): string {
  return FIELDS.find((f) => f.key === key)?.label ?? key;
}
