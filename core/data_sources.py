"""Load raw data from one of three sources: the bundled demo, a user upload,
or a user-supplied database connection.

These functions return the *raw* DataFrame exactly as found. Column mapping and
normalization happen afterwards in :mod:`core.schema`.
"""
from __future__ import annotations

import os

import pandas as pd
from sqlalchemy import create_engine, text

DEMO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "demo_countries.csv")


def load_demo() -> pd.DataFrame:
    """Load the bundled illustrative demo dataset (no DB required)."""
    return pd.read_csv(DEMO_PATH)


def load_upload(uploaded_file) -> pd.DataFrame:
    """Load a user-uploaded CSV or Excel file (Streamlit UploadedFile or path)."""
    name = getattr(uploaded_file, "name", str(uploaded_file)).lower()
    if name.endswith((".xlsx", ".xls")):
        return pd.read_excel(uploaded_file)
    try:
        return pd.read_csv(uploaded_file)
    except UnicodeDecodeError:
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
        return pd.read_csv(uploaded_file, encoding="latin-1")


def load_database(conn_str: str, table: str = None, query: str = None) -> pd.DataFrame:
    """Read a table (or a custom SELECT) from any SQLAlchemy-supported database.

    Connection string examples::

        postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
        mysql+pymysql://USER:PASSWORD@HOST:3306/DBNAME
        sqlite:///relative/or/absolute/path.db
    """
    if not conn_str:
        raise ValueError("A database connection string is required.")
    if not query and not table:
        raise ValueError("Provide either a table name or a SQL query.")

    engine = create_engine(conn_str)
    try:
        if query:
            sql = text(query)
        else:
            # Safely quote the identifier(s) for this dialect so a table name
            # like  evil" WHERE "1"="1  cannot break out of the identifier and
            # inject SQL — it becomes a single (escaped) identifier instead.
            preparer = engine.dialect.identifier_preparer
            parts = [p for p in str(table).split(".") if p]  # allow schema.table
            if not parts:
                raise ValueError("Invalid table name.")
            quoted = ".".join(preparer.quote(p) for p in parts)
            sql = text(f"SELECT * FROM {quoted}")
        with engine.connect() as con:
            return pd.read_sql(sql, con)
    finally:
        engine.dispose()


def test_connection(conn_str: str) -> tuple:
    """Return (ok, message) after a lightweight ``SELECT 1`` probe."""
    try:
        engine = create_engine(conn_str)
        try:
            with engine.connect() as con:
                con.execute(text("SELECT 1"))
        finally:
            engine.dispose()
        return True, "连接成功 / Connected"
    except Exception as exc:  # noqa: BLE001 - surface any driver/connection error
        return False, str(exc)
