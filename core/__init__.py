"""Global Risk Watch — core framework package.

The app is intentionally split into small, replaceable modules so it can be
used as a *template*:

- :mod:`core.schema`       — canonical column schema + column mapping
- :mod:`core.risk_model`   — pluggable risk-scoring methodology
- :mod:`core.data_sources` — load data from the demo file / an upload / a database
- :mod:`core.ai`           — pluggable AI provider (offline / Ollama / OpenAI-compatible)
- :mod:`core.config`       — read defaults from env vars or Streamlit secrets

Nothing here hardcodes credentials. Bring your own data and your own database.
"""

__all__ = ["schema", "risk_model", "data_sources", "ai", "config"]
__version__ = "1.0.0"
