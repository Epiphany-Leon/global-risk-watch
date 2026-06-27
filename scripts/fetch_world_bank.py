"""Reference ETL: pull real macro indicators from the World Bank API, compute
risk scores with :mod:`core.risk_model`, and write the result to a CSV and/or a
database.

This is the framework's example of a *real* data pipeline. It is optional — the
app ships with a demo dataset and also accepts uploads.

Requires:  pip install wbgapi
Examples
--------
    # Write to CSV only
    python scripts/fetch_world_bank.py --csv data/world_bank.csv

    # Write straight into your database
    python scripts/fetch_world_bank.py \
        --db-url postgresql+psycopg2://USER:PASS@localhost:5432/mydb --table countries
"""
from __future__ import annotations

import argparse
import os
import sys

import pandas as pd

# Make `core` importable when run as a standalone script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import risk_model  # noqa: E402

INDICATORS = {
    "NY.GDP.MKTP.CD": "gdp",            # GDP (current US$)
    "SP.POP.TOTL": "pop",              # Population
    "FP.CPI.TOTL.ZG": "inflation",     # Inflation, consumer prices (%)
    "SL.UEM.TOTL.ZS": "unemployment",  # Unemployment (% of labor force)
    "DT.DOD.DECT.GN.ZS": "external_debt",  # External debt stocks (% of GNI)
}


def fetch() -> pd.DataFrame:
    import wbgapi as wb  # lazy import so the script file imports without the dep

    print("🌍 Querying the World Bank API (this can take ~30s)...")
    df = wb.data.DataFrame(INDICATORS.keys(), labels=True, mrv=1)
    df.reset_index(inplace=True)
    df.rename(columns=INDICATORS, inplace=True)
    df.rename(columns={"economy": "iso_code", "Country": "country"}, inplace=True)

    meta = wb.economy.DataFrame()[["latitude", "longitude"]]
    df = df.join(meta, on="iso_code")
    return df


def transform(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in df.iterrows():
        lat = r.get("latitude")
        lon = r.get("longitude")
        if pd.isna(lat) or pd.isna(lon):
            continue  # skip aggregates ("Arab World", "OECD", ...) that have no coordinates

        canon = {
            "iso_code": r.get("iso_code"),
            "country": r.get("country"),
            "gdp_billion_usd": round((r.get("gdp") or 0) / 1_000_000_000, 2),
            "population_million": round((r.get("pop") or 0) / 1_000_000, 2),
            "inflation_rate": None if pd.isna(r.get("inflation")) else round(r.get("inflation"), 2),
            "unemployment_rate": None if pd.isna(r.get("unemployment")) else round(r.get("unemployment"), 2),
            "external_debt_gni_pct": None if pd.isna(r.get("external_debt")) else round(r.get("external_debt"), 2),
            "latitude": lat,
            "longitude": lon,
        }
        canon["risk_score"] = risk_model.compute_risk_score(canon)
        canon["risk_rating"] = risk_model.get_risk_rating(canon["risk_score"])
        rows.append(canon)
    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description="Fetch World Bank data and compute risk scores.")
    parser.add_argument("--csv", default="data/world_bank.csv", help="Output CSV path.")
    parser.add_argument("--db-url", default=os.environ.get("DB_URL"),
                        help="Optional SQLAlchemy connection string to also write a DB table.")
    parser.add_argument("--table", default=os.environ.get("DB_TABLE", "countries"),
                        help="Destination DB table name.")
    args = parser.parse_args()

    out = transform(fetch())
    print(f"✅ Built {len(out)} country rows.")

    if args.csv:
        os.makedirs(os.path.dirname(os.path.abspath(args.csv)), exist_ok=True)
        out.to_csv(args.csv, index=False)
        print(f"💾 Wrote CSV -> {args.csv}")

    if args.db_url:
        from sqlalchemy import create_engine

        engine = create_engine(args.db_url)
        try:
            out.to_sql(args.table, engine, if_exists="replace", index=False)
        finally:
            engine.dispose()
        print(f"💾 Wrote DB table -> {args.table}")


if __name__ == "__main__":
    main()
