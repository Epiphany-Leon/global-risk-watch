"""AI provider abstraction.

FRAMEWORK EXTENSION POINT
-------------------------
Three providers, all optional:

- ``offline`` — no AI, no keys, no network. Renders a deterministic templated
  report from the structured indicators so the demo works out of the box.
- ``ollama``  — local LLM via the ``ollama`` Python package.
- ``openai``  — any OpenAI-compatible endpoint (OpenAI, DeepSeek, Together,
  Groq, ...) selected by ``base_url`` + ``api_key``.

:func:`stream_report` is a generator yielding text chunks. ``context`` is the
structured data used by the offline renderer; ``prompt`` is the natural-language
instruction sent to the LLM providers.
"""
from __future__ import annotations

PROVIDERS = ["offline", "ollama", "openai"]


def stream_report(prompt: str, context: dict, cfg: dict):
    provider = (cfg or {}).get("provider", "offline")
    if provider == "ollama":
        yield from _ollama(prompt, cfg)
    elif provider == "openai":
        yield from _openai(prompt, cfg)
    else:
        yield from _offline(context)


def _ollama(prompt: str, cfg: dict):
    import ollama  # lazy import — only needed when this provider is selected

    model = cfg.get("model") or "qwen2.5"
    stream = ollama.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    for chunk in stream:
        yield chunk["message"]["content"]


def _openai(prompt: str, cfg: dict):
    from openai import OpenAI  # lazy import

    client = OpenAI(
        api_key=cfg.get("api_key") or "not-needed",
        base_url=cfg.get("base_url") or None,
    )
    model = cfg.get("model") or "gpt-4o-mini"
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _fmt(value, suffix=""):
    if value is None:
        return "N/A"
    try:
        return f"{float(value):g}{suffix}"
    except (TypeError, ValueError):
        return f"{value}{suffix}"


def _offline(context: dict):
    """Deterministic, dependency-free Markdown report from the indicators."""
    c = context or {}
    country = c.get("country", "—")
    iso = c.get("iso_code", "—")
    rating = c.get("risk_rating", "NR")
    score = c.get("risk_score")
    inflation = c.get("inflation_rate")
    debt = c.get("external_debt_gni_pct")
    gdp = c.get("gdp_billion_usd")
    is_sim = c.get("is_sim", False)

    flags = []
    if isinstance(inflation, (int, float)) and inflation > 10:
        flags.append(f"通胀率 {inflation:g}% 已越过 10% 警戒线 / inflation above the 10% warning line")
    if isinstance(debt, (int, float)) and debt > 60:
        flags.append(f"外债/GNI {debt:g}% 已越过 60% 警戒线 / external debt above the 60% warning line")
    if not flags:
        flags.append("核心指标暂未触发预警阈值 / no core indicator breaches a warning threshold")

    mode = "🧪 沙盘推演结果 (Simulated)" if is_sim else "📄 基线研报 (Baseline)"

    lines = [
        f"## {mode}：{country} ({iso})",
        "",
        f"- 🛡️ 基础评级 / Rating: **{rating}**　|　风险分 / Score: **{_fmt(score)}**",
        f"- 📈 通胀率 / Inflation: **{_fmt(inflation, '%')}**　(警戒线 / warn > 10%)",
        f"- 💰 外债占 GNI / External debt: **{_fmt(debt, '%')}**　(警戒线 / warn > 60%)",
        f"- 💵 GDP: **{_fmt(gdp, ' B USD')}**",
        "",
        "### 🚩 核心定性 / Assessment",
        ("当前为假设性沙盘推演，以下结论基于模拟设定而非真实数据。"
         if is_sim else "以下为基于现有指标的快速定性分析。"),
        "",
        "### 🔍 风险信号 / Risk signals",
    ]
    lines += [f"- {f}" for f in flags]
    lines += [
        "",
        "### 💡 提示 / Note",
        ("这是 **离线模板** 生成的示例研报（无需 AI 与网络）。在侧边栏切换 AI 供应商 "
         "(Ollama / OpenAI 兼容 API) 即可获得真正的大模型深度分析。"),
        "",
        "_本内容仅供框架演示，非投资建议 / Illustrative demo output, not investment advice._",
    ]
    for line in lines:
        yield line + "\n"
