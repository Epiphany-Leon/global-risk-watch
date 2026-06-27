"""Canonical data schema + column mapping.

FRAMEWORK EXTENSION POINT
-------------------------
The app renders a choropleth map, a data table and AI reports from a
*normalized* DataFrame whose columns follow the canonical names below. Any user
dataset (CSV / Excel / SQL table) is mapped onto these canonical columns —
automatically (by fuzzy name matching) or manually via the column-mapping UI.

Only ``iso_code`` and ``country`` are strictly required. ``risk_score`` is
derived by :mod:`core.risk_model` when it is missing, so a dataset that only
carries raw indicators (inflation, debt, GDP, ...) still works.
"""
from __future__ import annotations

import pandas as pd

# (canonical_name, human label, required?, kind)  kind in {"id", "text", "num"}
FIELDS = [
    ("iso_code", "ISO-3 国家代码 / ISO-3 code", True, "id"),
    ("country", "国家名称 / Country name", True, "text"),
    ("risk_score", "风险分 0-100 / Risk score", False, "num"),   # derived if absent
    ("risk_rating", "评级 / Rating", False, "text"),              # derived if absent
    ("inflation_rate", "通胀率 % / Inflation", False, "num"),
    ("external_debt_gni_pct", "外债占 GNI % / External debt", False, "num"),
    ("unemployment_rate", "失业率 % / Unemployment", False, "num"),
    ("gdp_billion_usd", "GDP 十亿美元 / GDP (B USD)", False, "num"),
    ("population_million", "人口 百万 / Population (M)", False, "num"),
    ("latitude", "纬度 / Latitude", False, "num"),
    ("longitude", "经度 / Longitude", False, "num"),
]

CANONICAL = [f[0] for f in FIELDS]
LABELS = {f[0]: f[1] for f in FIELDS}
REQUIRED = [f[0] for f in FIELDS if f[2]]
NUMERIC = [f[0] for f in FIELDS if f[3] == "num"]

# Common header aliases used for best-effort auto-detection.
ALIASES = {
    "iso_code": ["iso_code", "iso", "iso3", "iso_a3", "cca3", "country_code", "code", "alpha3", "alpha_3"],
    "country": ["country", "name", "country_name", "nation", "economy"],
    "risk_score": ["risk_score", "score", "risk"],
    "risk_rating": ["risk_rating", "rating", "grade"],
    "inflation_rate": ["inflation_rate", "inflation", "cpi"],
    "external_debt_gni_pct": ["external_debt_gni_pct", "external_debt", "debt_gni", "debt"],
    "unemployment_rate": ["unemployment_rate", "unemployment", "jobless"],
    "gdp_billion_usd": ["gdp_billion_usd", "gdp_billion", "gdp_usd", "gdp"],
    "population_million": ["population_million", "population", "pop"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "lon", "lng", "long"],
}

NONE_LABEL = "（无 / none）"


def auto_map(columns) -> dict:
    """Return ``{canonical: source_column or None}`` guessed from ``columns``."""
    lower = {str(c).lower().strip(): c for c in columns}
    mapping = {}
    for canon in CANONICAL:
        found = None
        for alias in ALIASES[canon]:
            if alias in lower:
                found = lower[alias]
                break
        mapping[canon] = found
    return mapping


def apply_mapping(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    """Project ``df`` onto canonical columns; missing columns become NA."""
    out = pd.DataFrame(index=df.index)
    for canon in CANONICAL:
        src = mapping.get(canon)
        out[canon] = df[src] if (src and src in df.columns) else pd.NA
    for col in NUMERIC:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    out["iso_code"] = out["iso_code"].astype("string").str.strip().str.upper()
    out["country"] = out["country"].astype("string").str.strip()
    out["risk_rating"] = out["risk_rating"].astype("string").str.strip()
    return out


def normalize(df: pd.DataFrame, mapping: dict, risk_model) -> pd.DataFrame:
    """Map columns, drop invalid rows, then derive risk_score/rating if missing."""
    out = apply_mapping(df, mapping)

    # Keep only rows with a valid 3-letter ISO code.
    out = out.dropna(subset=["iso_code"])
    out = out[out["iso_code"].str.len() == 3].copy()

    # Derive a risk score for any row that lacks one.
    missing_score = out["risk_score"].isna()
    if missing_score.any():
        out.loc[missing_score, "risk_score"] = out.loc[missing_score].apply(
            risk_model.compute_risk_score, axis=1
        )

    # Fill rating from score wherever it is missing.
    missing_rating = out["risk_rating"].isna() | (out["risk_rating"].astype("string") == "")
    out.loc[missing_rating, "risk_rating"] = out.loc[missing_rating, "risk_score"].apply(
        risk_model.get_risk_rating
    )

    return out.reset_index(drop=True)


def missing_required(df: pd.DataFrame) -> list:
    """Return required canonical columns that are entirely empty in ``df``."""
    bad = []
    for col in REQUIRED:
        if col not in df.columns or df[col].isna().all():
            bad.append(col)
    return bad
