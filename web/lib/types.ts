export interface CountryRaw {
  iso_code: string;
  country: string;
  gdp_billion_usd?: number | null;
  population_million?: number | null;
  inflation_rate?: number | null;
  unemployment_rate?: number | null;
  external_debt_gni_pct?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  risk_score?: number | null;
  risk_rating?: string | null;
}

export interface Country extends CountryRaw {
  risk_score: number;
  risk_rating: string;
}

// The /api/report wire payload (baseUrl/model/apiKey) is the per-provider
// ProviderConfig defined in lib/providers.ts.
export interface Sim {
  inflation: number;
  debt: number;
}
