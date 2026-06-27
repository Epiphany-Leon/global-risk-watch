"""Configuration helpers.

Defaults are read from environment variables or Streamlit secrets — **never**
hardcoded. Everything can also be entered live in the app's sidebar, so the
demo runs with zero configuration.

Lookup order for every key: ``st.secrets`` → environment variable → fallback.
"""
from __future__ import annotations

import os


def _get(key: str, default=None):
    # st.secrets is optional; accessing it without a secrets.toml raises, so guard it.
    try:
        import streamlit as st

        if key in st.secrets:
            return st.secrets[key]
    except Exception:
        pass
    return os.environ.get(key, default)


def default_db_url() -> str:
    return _get("DB_URL") or _get("DATABASE_URL") or ""


def default_db_table() -> str:
    return _get("DB_TABLE", "countries")


def ai_defaults() -> dict:
    """Default AI settings. Provider 'offline' needs no keys and powers the demo."""
    return {
        "provider": _get("AI_PROVIDER", "offline"),
        "model": _get("AI_MODEL", "qwen2.5"),
        "base_url": _get("AI_BASE_URL", ""),
        "api_key": _get("AI_API_KEY", ""),
    }
