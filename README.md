# 🌍 Global Risk Watch

> A **configurable macro-risk dashboard framework** built with Streamlit.
> Bring your own data and your own database — the bundled demo runs with **zero configuration**.
>
> 一个**可配置的宏观风险预警框架**：你可以自行上传数据、连接自己的数据库；内置演示数据**零配置**即可运行。

[![Python](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)
[![Streamlit](https://img.shields.io/badge/built%20with-Streamlit-FF4B4B)](https://streamlit.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌐 Two ways to run / 两种形态

**▶ Live demo (Next.js on Vercel): https://global-risk-watch.vercel.app**

| | Stack | Best for | Hosting |
|---|-------|----------|---------|
| **Python framework** (repo root) | Streamlit + SQLAlchemy | the extensible **framework** — connect any SQLAlchemy database, plug in your own risk model / AI provider | local / Streamlit Cloud |
| **Web demo** ([`web/`](web/)) | Next.js + TypeScript | a polished, shareable **demo** deployable to **Vercel** | **[live](https://global-risk-watch.vercel.app)** · one-command CLI deploy |

Both share the same concepts (data sources, canonical schema, pluggable risk model, AI provider). See [`web/README.md`](web/README.md) for the Next.js app.

```bash
cd web && npm install && npm run dev      # http://localhost:3000, zero config
```

---

## ✨ Features / 功能

- 🗺️ **Interactive risk heatmap** — Plotly choropleth colored by a 0–100 risk score.
- 📊 **Live data table** with filtering by risk threshold.
- 🎛️ **What-if sandbox** — drag inflation / external-debt sliders and re-run the analysis on a simulated scenario.
- 🧠 **AI risk reports** — pluggable provider: **offline template** (no setup), **Ollama** (local LLM), or any **OpenAI-compatible API** (OpenAI / DeepSeek / …).
- 📥 **Three data sources** — built-in demo, file upload (CSV/Excel), or **your own database**.
- 🧩 **Framework-first** — risk model, schema, data sources and AI provider are small, replaceable modules. No credentials are hardcoded.

---

## 🚀 Quickstart (demo, zero config) / 快速开始

```bash
git clone https://github.com/Epiphany-Leon/global-risk-watch.git
cd global-risk-watch

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

streamlit run app.py
```

The app opens with the **Demo** data source and the **offline** AI provider selected — it works immediately, no database and no API key required.

打开后默认使用「演示数据」+「离线 AI」，无需数据库、无需 API Key，立即可用。

---

## 📦 Bring your own data / 接入你自己的数据

Pick a source in the sidebar (**Data source**). Whatever the column names are, map them to the canonical fields in the **🔧 Column mapping** panel. Only `iso_code` (ISO-3) and `country` are required; `risk_score` is auto-derived from raw indicators when absent.

在侧边栏「数据源」中选择来源；无论你的列名是什么，都可在「列映射」里对应到标准字段。仅 **ISO-3 代码** 与 **国家名称** 为必填，未提供风险分时会由内置模型自动计算。

### 1) Upload a file / 上传文件
Sidebar → **Upload** → choose a `.csv` / `.xlsx`. A minimal file looks like:

```csv
iso_code,country,inflation_rate,external_debt_gni_pct,gdp_billion_usd
ARG,Argentina,133.5,45,640
CHN,China,0.2,14,17790
```

### 2) Connect a database / 连接数据库
Sidebar → **Database** → paste a SQLAlchemy connection string (it is **not** stored), set the table name, optionally a custom `SELECT`.

```
PostgreSQL  postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
MySQL       mysql+pymysql://USER:PASSWORD@HOST:3306/DBNAME
SQLite      sqlite:///path/to/file.db
```

Install the matching driver (`psycopg2-binary` for PostgreSQL, `PyMySQL` for MySQL).

#### Load a CSV into a fresh database / 把 CSV 灌入数据库
```bash
python scripts/load_into_db.py \
  --db-url postgresql+psycopg2://USER:PASS@localhost:5432/mydb \
  --csv data/demo_countries.csv --table countries
```

### 3) Set defaults (optional) / 设置默认值
Copy `.env.example` → `.env`, or `.streamlit/secrets.toml.example` → `.streamlit/secrets.toml`, to prefill the DB connection and AI provider. Both files are gitignored.

---

## 🤖 AI providers / AI 供应商

Choose in the sidebar (**AI settings**):

| Provider | Setup | Use |
|----------|-------|-----|
| `offline` | none | Deterministic templated report — powers the demo. |
| `ollama` | `pip install ollama` + a local model (`ollama pull qwen2.5`) | Private, local LLM. |
| `openai` | `pip install openai` + Base URL & API Key | OpenAI, DeepSeek, Together, Groq, any OpenAI-compatible endpoint. |

Example for DeepSeek: Base URL `https://api.deepseek.com/v1`, Model `deepseek-chat`.

---

## 🧩 Framework extension points / 框架扩展点

| File | Replace to change… |
|------|--------------------|
| [`core/risk_model.py`](core/risk_model.py) | the **scoring methodology** (`compute_risk_score`, `get_risk_rating`). |
| [`core/schema.py`](core/schema.py) | the **canonical columns** and auto-mapping aliases. |
| [`core/data_sources.py`](core/data_sources.py) | how data is **loaded** (add an API, a warehouse, …). |
| [`core/ai.py`](core/ai.py) | the **AI provider** (add Anthropic, Gemini, vLLM, …). |
| [`core/config.py`](core/config.py) | where **defaults** come from (env / secrets). |

---

## 🗂️ Project structure / 目录结构

```
global-risk-watch/
├── app.py                       # Streamlit app (the framework UI)
├── core/
│   ├── config.py                # defaults from env / st.secrets (no hardcoded creds)
│   ├── data_sources.py          # demo / upload / database loaders
│   ├── schema.py                # canonical schema + column mapping
│   ├── risk_model.py            # pluggable risk-scoring model
│   └── ai.py                    # offline / ollama / openai providers
├── data/
│   └── demo_countries.csv       # bundled illustrative demo dataset
├── scripts/
│   ├── generate_demo_data.py    # rebuild the demo CSV
│   ├── load_into_db.py          # load any CSV/Excel into your database
│   └── fetch_world_bank.py      # optional real-data ETL (World Bank API)
├── .streamlit/config.toml       # theme + upload limit
├── .env.example                 # config template (DB + AI)
├── requirements.txt
└── LICENSE
```

---

## ⚠️ Disclaimer / 免责声明

The bundled demo numbers and the default risk model are **illustrative** and provided for demonstration only. This project is **not** financial or investment advice.

内置演示数据与默认风险模型仅供演示，**非投资建议**。

## 📄 License

[MIT](LICENSE) © 2026 Lihong Gao
