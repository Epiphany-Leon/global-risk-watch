"""Pluggable risk-scoring model.

FRAMEWORK EXTENSION POINT
-------------------------
Replace :func:`compute_risk_score` with your own methodology. It receives one
row (pandas ``Series`` or ``dict``) of canonical indicator columns and must
return a float in ``[0, 100]`` where **higher = riskier**.

The default below is an illustrative weighted model inspired by sovereign-risk
heuristics (inflation, unemployment, external debt, GDP buffer). It is a demo,
**not** investment advice.
"""
from __future__ import annotations

import math


def _num(row, key, default=None):
    """Safely read a numeric field from a Series/dict, treating NaN as missing."""
    try:
        val = row[key]
    except (KeyError, IndexError, TypeError):
        val = None
    if val is None:
        return default
    try:
        f = float(val)
    except (TypeError, ValueError):
        return default
    if math.isnan(f):
        return default
    return f


def compute_risk_score(row) -> float:
    """Weighted 0-100 risk score from canonical indicator columns."""
    score = 40.0  # neutral baseline

    inflation = _num(row, "inflation_rate")
    unemployment = _num(row, "unemployment_rate")
    debt = _num(row, "external_debt_gni_pct")
    gdp = _num(row, "gdp_billion_usd")

    # Inflation risk
    if inflation is not None:
        if inflation > 100:
            score += 40            # hyperinflation
        elif inflation > 20:
            score += 20
        elif inflation > 10:
            score += 10
        elif inflation < 0:
            score += 5             # deflation also carries risk

    # Unemployment risk
    if unemployment is not None:
        if unemployment > 20:
            score += 15
        elif unemployment > 10:
            score += 8

    # External-debt risk (% of GNI)
    if debt is not None:
        if debt > 100:
            score += 25
        elif debt > 60:
            score += 15

    # GDP buffer — larger economies absorb shocks better
    if gdp is not None:
        if gdp > 10000:
            score -= 20
        elif gdp > 1000:
            score -= 10
        elif gdp < 20:
            score += 10

    return round(max(0.0, min(100.0, score)), 1)


def get_risk_rating(score) -> str:
    """Map a 0-100 score to an S&P-style letter rating."""
    try:
        s = float(score)
    except (TypeError, ValueError):
        return "NR"
    if math.isnan(s):
        return "NR"
    if s < 20:
        return "AAA"
    if s < 30:
        return "AA"
    if s < 40:
        return "A"
    if s < 50:
        return "BBB"
    if s < 60:
        return "BB"
    if s < 70:
        return "B"
    if s < 80:
        return "CCC"
    return "D"
