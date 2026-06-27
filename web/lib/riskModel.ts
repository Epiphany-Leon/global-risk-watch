// FRAMEWORK EXTENSION POINT — pluggable risk-scoring model.
// Mirrors core/risk_model.py. Replace `computeRiskScore` with your own
// methodology: higher score = riskier, clamped to [0, 100].
// Illustrative demo model, NOT investment advice.

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const f = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(f) ? null : f;
}

export function computeRiskScore(r: Record<string, unknown>): number {
  let score = 40; // neutral baseline

  const inflation = toNum(r.inflation_rate);
  const unemployment = toNum(r.unemployment_rate);
  const debt = toNum(r.external_debt_gni_pct);
  const gdp = toNum(r.gdp_billion_usd);

  if (inflation !== null) {
    if (inflation > 100) score += 40;
    else if (inflation > 20) score += 20;
    else if (inflation > 10) score += 10;
    else if (inflation < 0) score += 5;
  }
  if (unemployment !== null) {
    if (unemployment > 20) score += 15;
    else if (unemployment > 10) score += 8;
  }
  if (debt !== null) {
    if (debt > 100) score += 25;
    else if (debt > 60) score += 15;
  }
  if (gdp !== null) {
    if (gdp > 10000) score -= 20;
    else if (gdp > 1000) score -= 10;
    else if (gdp < 20) score += 10;
  }

  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

export function getRiskRating(score: number): string {
  if (Number.isNaN(score)) return "NR";
  if (score < 20) return "AAA";
  if (score < 30) return "AA";
  if (score < 40) return "A";
  if (score < 50) return "BBB";
  if (score < 60) return "BB";
  if (score < 70) return "B";
  if (score < 80) return "CCC";
  return "D";
}
