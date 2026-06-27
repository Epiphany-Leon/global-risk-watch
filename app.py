"""Global Risk Watch — a configurable macro-risk dashboard framework.

Bring your own data (demo file / upload / database) and your own AI provider
(offline template / Ollama / OpenAI-compatible API). Nothing is hardcoded.

Run:  streamlit run app.py
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from core import ai, config, data_sources, risk_model, schema

# --- 1. Page config & session state ------------------------------------------
st.set_page_config(page_title="Global Risk Watch", page_icon="🌍", layout="wide")

st.session_state.setdefault("report_text", "")
st.session_state.setdefault("report_country", "")
st.session_state.setdefault("db_raw", None)        # cached raw DataFrame from a DB connection
st.session_state.setdefault("sim_country", None)


# --- 2. Helpers --------------------------------------------------------------
def rating_box(col, rating: str):
    r = rating if isinstance(rating, str) else "NR"
    if r.startswith("A"):
        col.success(f"评级 / Rating: {r}")
    elif r.startswith("B"):
        col.warning(f"评级 / Rating: {r}")
    else:
        col.error(f"评级 / Rating: {r}")


def real_value(row, col_name):
    val = row.get(col_name)
    return float(val) if pd.notna(val) else 0.0


def build_prompt(country, row, sim):
    iso = row.get("iso_code", "")
    rating = row.get("risk_rating", "NR")
    inflation = sim["inflation"] if sim else real_value(row, "inflation_rate")
    debt = sim["debt"] if sim else real_value(row, "external_debt_gni_pct")
    gdp = row.get("gdp_billion_usd")
    gdp_str = f"{gdp} B USD" if pd.notna(gdp) else "N/A"

    scenario = ""
    if sim:
        scenario = (
            "\n【⚠️ 沙盘推演模式 / What-If Scenario】\n"
            f"- 真实通胀 {real_value(row, 'inflation_rate'):g}% -> 模拟 {inflation:g}%\n"
            f"- 真实外债 {real_value(row, 'external_debt_gni_pct'):g}% -> 模拟 {debt:g}%\n"
            "请基于**模拟设定**推演社会经济后果。\n"
        )

    return f"""你是一位顶级宏观策略分析师（风格类似《经济学人》）。

【分析目标 / Target: {country} ({iso})】
{scenario}
【核心宏观数据 / Key indicators】
- 🛡️ 基础评级 / Rating: {rating}
- 📈 通胀率 / Inflation (CPI): {inflation:g}% (警戒线 > 10%)
- 💰 外债占 GNI / External debt: {debt:g}% (警戒线 > 60%)
- 💵 GDP: {gdp_str}

【任务 / Task】请用标准 Markdown 撰写一份深度风险研报：
1. 🚩 核心定性（若为模拟请强调这是推演）
2. 🔍 深度归因（通胀 {inflation:g}% 与债务 {debt:g}% 的社会冲击）
3. 💡 三条具体建议
"""


def build_context(country, row, sim):
    return {
        "country": country,
        "iso_code": row.get("iso_code", ""),
        "risk_rating": row.get("risk_rating", "NR"),
        "risk_score": (float(row["risk_score"]) if pd.notna(row.get("risk_score")) else None),
        "inflation_rate": sim["inflation"] if sim else (
            float(row["inflation_rate"]) if pd.notna(row.get("inflation_rate")) else None),
        "external_debt_gni_pct": sim["debt"] if sim else (
            float(row["external_debt_gni_pct"]) if pd.notna(row.get("external_debt_gni_pct")) else None),
        "gdp_billion_usd": (float(row["gdp_billion_usd"]) if pd.notna(row.get("gdp_billion_usd")) else None),
        "is_sim": bool(sim),
    }


def column_mapping_ui(raw: pd.DataFrame) -> dict:
    """Render the column-mapping expander and return {canonical: source_col|None}."""
    guess = schema.auto_map(raw.columns)
    options = [schema.NONE_LABEL] + list(raw.columns)
    mapping = {}
    with st.expander("🔧 列映射 / Column mapping", expanded=bool(schema.missing_required(
            schema.apply_mapping(raw, guess)))):
        st.caption("将你的数据列对应到标准字段。仅 ISO 代码与国家名称为必填。")
        for canon in schema.CANONICAL:
            default = guess.get(canon)
            idx = options.index(default) if default in options else 0
            star = " *" if canon in schema.REQUIRED else ""
            chosen = st.selectbox(
                f"{schema.LABELS[canon]}{star}",
                options=options,
                index=idx,
                key=f"map_{canon}",
            )
            mapping[canon] = None if chosen == schema.NONE_LABEL else chosen
    return mapping


# --- 3. Sidebar: data source --------------------------------------------------
with st.sidebar:
    st.header("🕹️ 风险控制台 / Console")

    st.subheader("📥 数据源 / Data source")
    source = st.radio(
        "选择数据来源 / Choose source",
        ["演示数据 / Demo", "上传文件 / Upload", "连接数据库 / Database"],
        label_visibility="collapsed",
    )

    raw_df = None
    if source.startswith("演示"):
        raw_df = data_sources.load_demo()
        st.caption(f"已载入内置演示数据（{len(raw_df)} 国）。仅供演示，非真实数据。")
    elif source.startswith("上传"):
        up = st.file_uploader("上传 CSV 或 Excel / Upload CSV or Excel", type=["csv", "xlsx", "xls"])
        if up is not None:
            try:
                raw_df = data_sources.load_upload(up)
            except Exception as exc:  # noqa: BLE001
                st.error(f"读取文件失败 / Failed to read file: {exc}")
        else:
            st.info("请上传文件。需包含国家 ISO-3 代码列。")
    else:  # Database
        st.caption("连接你自己的数据库（连接串不会被保存）。")
        conn_str = st.text_input(
            "连接串 / Connection string",
            value=config.default_db_url(),
            type="password",
            placeholder="postgresql+psycopg2://user:pass@host:5432/db",
        )
        table = st.text_input("表名 / Table", value=config.default_db_table())
        custom_query = st.text_input("自定义 SQL（可选）/ Custom SQL (optional)", value="")
        cc1, cc2 = st.columns(2)
        if cc1.button("🔌 连接 / Connect", use_container_width=True):
            ok, msg = data_sources.test_connection(conn_str)
            if not ok:
                st.error(f"连接失败 / Failed: {msg}")
                st.session_state.db_raw = None
            else:
                try:
                    st.session_state.db_raw = data_sources.load_database(
                        conn_str, table=table or None, query=custom_query or None)
                    st.success(f"已读取 {len(st.session_state.db_raw)} 行 / rows")
                except Exception as exc:  # noqa: BLE001
                    st.error(f"查询失败 / Query failed: {exc}")
                    st.session_state.db_raw = None
        if cc2.button("🧹 清除 / Clear", use_container_width=True):
            st.session_state.db_raw = None
        raw_df = st.session_state.db_raw

    # Column mapping + normalization
    df = pd.DataFrame()
    if raw_df is not None and not raw_df.empty:
        mapping = column_mapping_ui(raw_df)
        try:
            df = schema.normalize(raw_df, mapping, risk_model)
        except Exception as exc:  # noqa: BLE001
            st.error(f"标准化失败 / Normalization error: {exc}")

    st.divider()

    # --- AI settings ---------------------------------------------------------
    st.subheader("🤖 AI 设置 / AI settings")
    ai_def = config.ai_defaults()
    provider = st.selectbox(
        "供应商 / Provider", ai.PROVIDERS,
        index=ai.PROVIDERS.index(ai_def["provider"]) if ai_def["provider"] in ai.PROVIDERS else 0,
        help="offline=离线模板(无需配置)；ollama=本地大模型；openai=任意 OpenAI 兼容 API",
    )
    ai_cfg = {"provider": provider}
    if provider != "offline":
        ai_cfg["model"] = st.text_input("模型 / Model", value=ai_def["model"])
    if provider == "openai":
        ai_cfg["base_url"] = st.text_input(
            "Base URL", value=ai_def["base_url"],
            placeholder="https://api.deepseek.com/v1")
        ai_cfg["api_key"] = st.text_input("API Key", value=ai_def["api_key"], type="password")

    st.divider()

    # --- Filter --------------------------------------------------------------
    min_score = st.slider("⚠️ 过滤低风险国家 / Min risk", 0, 100, 0)


# --- 4. Main: guard for empty data -------------------------------------------
st.title("🌍 Global Risk Watch · 宏观风险预警框架")

if df.empty:
    st.info("👈 在左侧选择数据源开始。内置「演示数据」可零配置直接体验。")
    st.stop()

missing = schema.missing_required(df)
if missing:
    st.warning("数据缺少必填列：" + ", ".join(schema.LABELS[m] for m in missing)
               + "。请在「列映射」中指定。")
    st.stop()


# --- 5. Sidebar (cont.): country select + sandbox ----------------------------
with st.sidebar:
    st.subheader("🎯 分析目标 / Target")
    df = df.copy()
    df["display_name"] = df["country"].astype(str) + " (" + df["iso_code"].astype(str) + ")"
    sorted_df = df.sort_values("risk_score", ascending=False)
    selected_display = st.selectbox("选择国家 / Country", options=sorted_df["display_name"].unique())
    selected_country = selected_display.rsplit(" (", 1)[0]
    target_row = df[df["country"] == selected_country].iloc[0]

    real_inf = real_value(target_row, "inflation_rate")
    real_debt = real_value(target_row, "external_debt_gni_pct")

    # reset sandbox values when the country changes
    if st.session_state.sim_country != selected_country:
        st.session_state.sim_country = selected_country
        st.session_state.sim_inflation = real_inf
        st.session_state.sim_debt = real_debt

    st.divider()
    st.subheader("🎛️ 命运推演 / Sandbox")
    st.caption("调整下面的假设值，AI 将基于模拟情景推演。")
    st.session_state.sim_inflation = st.slider(
        "假设通胀率 % / Inflation", 0.0, 500.0, float(st.session_state.sim_inflation))
    st.session_state.sim_debt = st.slider(
        "假设外债率 % / External debt", 0.0, 300.0, float(st.session_state.sim_debt))

    is_modified = (st.session_state.sim_inflation != real_inf) or (st.session_state.sim_debt != real_debt)
    if is_modified:
        st.warning("🔥 已进入沙盘模拟模式")
        if st.button("🔙 重置 / Reset", use_container_width=True):
            st.session_state.sim_inflation = real_inf
            st.session_state.sim_debt = real_debt
            st.rerun()
        sim_data = {"inflation": st.session_state.sim_inflation, "debt": st.session_state.sim_debt}
    else:
        sim_data = None


# --- 6. Main: map + table ----------------------------------------------------
filtered = df[df["risk_score"] >= min_score]
c_map, c_data = st.columns([3, 2])

with c_map:
    st.subheader(f"📍 风险热力图 / Heatmap (risk ≥ {min_score})")
    if not filtered.empty:
        fig = px.choropleth(
            filtered,
            locations="iso_code",
            color="risk_score",
            hover_name="country",
            hover_data=["risk_rating", "inflation_rate"],
            color_continuous_scale="RdYlGn_r",
            range_color=(0, 100),
            projection="natural earth",
        )
        fig.update_layout(
            margin={"r": 0, "t": 0, "l": 0, "b": 0},
            geo=dict(showframe=False, showcoastlines=False, bgcolor="rgba(0,0,0,0)"),
            height=420,
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("当前过滤条件下没有国家。")

with c_data:
    st.subheader("📊 数据监控 / Data")
    cols = ["iso_code", "country", "risk_score", "risk_rating",
            "inflation_rate", "external_debt_gni_pct"]
    cols = [c for c in cols if c in filtered.columns]
    view = filtered[cols].rename(columns={
        "iso_code": "ISO", "country": "国家", "risk_score": "风险分",
        "risk_rating": "评级", "inflation_rate": "通胀%", "external_debt_gni_pct": "外债%"})
    st.dataframe(view.sort_values("风险分", ascending=False),
                 hide_index=True, use_container_width=True, height=420)

st.divider()


# --- 7. Main: AI analysis panel ----------------------------------------------
st.subheader(f"🧠 智能战略分析 / Analysis: {selected_country}")

m1, m2, m3, m4 = st.columns(4)
rating_box(m1, target_row.get("risk_rating"))
m2.metric("ISO", target_row.get("iso_code", "—"))
cur_inf = st.session_state.sim_inflation
cur_debt = st.session_state.sim_debt
m3.metric("通胀率 (模拟)", f"{cur_inf:g}%", delta=f"{cur_inf - real_inf:.1f}%", delta_color="inverse")
m4.metric("外债率 (模拟)", f"{cur_debt:g}%", delta=f"{cur_debt - real_debt:.1f}%", delta_color="inverse")

btn_label = (f"🧪 运行沙盘推演 / Run scenario: {selected_country}"
             if is_modified else f"🚀 生成深度研报 / Generate report: {selected_country}")

if st.button(btn_label, type="primary"):
    if st.session_state.report_country != selected_country:
        st.session_state.report_text = ""
        st.session_state.report_country = selected_country

    label = "🤖 正在分析…" if provider != "offline" else "📝 正在生成离线研报…"
    with st.status(label, expanded=True) as status:
        placeholder = st.empty()
        full = ""
        try:
            prompt = build_prompt(selected_country, target_row, sim_data)
            context = build_context(selected_country, target_row, sim_data)
            for chunk in ai.stream_report(prompt, context, ai_cfg):
                full += chunk
                placeholder.markdown(full + "▌")
            placeholder.markdown(full)
            st.session_state.report_text = full
            status.update(label="✅ 分析完成 / Done", state="complete", expanded=False)
        except Exception as exc:  # noqa: BLE001
            status.update(label="❌ 失败 / Failed", state="error")
            st.error(f"AI 生成失败 / Generation failed: {exc}\n\n"
                     "提示：未配置 AI 时请将供应商切到 offline（离线模板）。")

if st.session_state.report_text:
    st.divider()
    st.markdown("### 📄 研报阅览 / Report")
    st.markdown(st.session_state.report_text)
    st.download_button("📥 下载报告 / Download",
                       st.session_state.report_text,
                       file_name=f"{selected_country}_risk_report.md")
