"""Load a CSV/Excel file into *your* database so the app can read it over a
connection string.

No credentials are hardcoded — pass ``--db-url`` or set the ``DB_URL`` env var.

Examples
--------
    # PostgreSQL
    python scripts/load_into_db.py \
        --db-url postgresql+psycopg2://USER:PASS@localhost:5432/mydb \
        --csv data/demo_countries.csv --table countries

    # SQLite (no server needed)
    python scripts/load_into_db.py \
        --db-url sqlite:///mydata.db \
        --csv data/demo_countries.csv --table countries
"""
from __future__ import annotations

import argparse
import os
import sys

import pandas as pd
from sqlalchemy import create_engine


def main():
    parser = argparse.ArgumentParser(description="Load a CSV/Excel file into a database table.")
    parser.add_argument("--db-url", default=os.environ.get("DB_URL"),
                        help="SQLAlchemy connection string (or set DB_URL env var).")
    parser.add_argument("--csv", default="data/demo_countries.csv",
                        help="Path to the source CSV or Excel file.")
    parser.add_argument("--table", default=os.environ.get("DB_TABLE", "countries"),
                        help="Destination table name (default: countries).")
    parser.add_argument("--if-exists", default="replace", choices=["replace", "append", "fail"],
                        help="What to do if the table already exists (default: replace).")
    args = parser.parse_args()

    if not args.db_url:
        sys.exit("❌ No database URL. Pass --db-url or set the DB_URL environment variable.")

    path = args.csv
    if path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)
    print(f"📄 Loaded {len(df)} rows from {path}")

    engine = create_engine(args.db_url)
    try:
        df.to_sql(args.table, engine, if_exists=args.if_exists, index=False)
    finally:
        engine.dispose()
    print(f"🎉 Wrote {len(df)} rows into table '{args.table}'.")
    print("➡️  Now point the app's 'Connect database' source at the same connection string.")


if __name__ == "__main__":
    main()
