// Deterministic, dependency-free risk report — powers the zero-config demo.
// Mirrors the `offline` provider in core/ai.py.

export interface ReportContext {
  country: string;
  iso_code: string;
  risk_rating: string;
  risk_score: number | null;
  inflation_rate: number | null;
  external_debt_gni_pct: number | null;
  gdp_billion_usd: number | null;
  is_sim: boolean;
}

function fmt(v: number | null, suffix = ""): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return `${v}${suffix}`;
}

export function offlineReport(c: ReportContext): string {
  const flags: string[] = [];
  if (c.inflation_rate !== null && c.inflation_rate > 10) {
    flags.push(`通胀率 ${c.inflation_rate}% 已越过 10% 警戒线 / inflation above the 10% warning line`);
  }
  if (c.external_debt_gni_pct !== null && c.external_debt_gni_pct > 60) {
    flags.push(`外债/GNI ${c.external_debt_gni_pct}% 已越过 60% 警戒线 / external debt above the 60% warning line`);
  }
  if (flags.length === 0) {
    flags.push("核心指标暂未触发预警阈值 / no core indicator breaches a warning threshold");
  }

  const mode = c.is_sim ? "🧪 沙盘推演结果 (Simulated)" : "📄 基线研报 (Baseline)";

  const lines = [
    `## ${mode}：${c.country} (${c.iso_code})`,
    "",
    `- 🛡️ 基础评级 / Rating: **${c.risk_rating}**　|　风险分 / Score: **${fmt(c.risk_score)}**`,
    `- 📈 通胀率 / Inflation: **${fmt(c.inflation_rate, "%")}**　(警戒线 / warn > 10%)`,
    `- 💰 外债占 GNI / External debt: **${fmt(c.external_debt_gni_pct, "%")}**　(警戒线 / warn > 60%)`,
    `- 💵 GDP: **${fmt(c.gdp_billion_usd, " B USD")}**`,
    "",
    "### 🚩 核心定性 / Assessment",
    c.is_sim
      ? "当前为假设性沙盘推演，以下结论基于模拟设定而非真实数据。"
      : "以下为基于现有指标的快速定性分析。",
    "",
    "### 🔍 风险信号 / Risk signals",
    ...flags.map((f) => `- ${f}`),
    "",
    "### 💡 提示 / Note",
    "这是 **离线模板** 生成的示例研报（无需 API Key）。在侧边栏将 AI 供应商切到 **OpenAI 兼容 API**（OpenAI / DeepSeek …）即可获得大模型深度分析。",
    "",
    "_本内容仅供框架演示，非投资建议 / Illustrative demo output, not investment advice._",
  ];
  return lines.join("\n");
}

export function buildPrompt(c: ReportContext): string {
  const scenario = c.is_sim
    ? `\n【⚠️ 沙盘推演模式 / What-If Scenario】\n- 模拟通胀 ${fmt(c.inflation_rate, "%")}\n- 模拟外债 ${fmt(c.external_debt_gni_pct, "%")}\n请基于模拟设定推演社会经济后果。\n`
    : "";
  return `你是一位顶级宏观策略分析师（风格类似《经济学人》）。

【分析目标 / Target: ${c.country} (${c.iso_code})】
${scenario}
【核心宏观数据 / Key indicators】
- 🛡️ 基础评级 / Rating: ${c.risk_rating}
- 📈 通胀率 / Inflation: ${fmt(c.inflation_rate, "%")} (警戒线 > 10%)
- 💰 外债占 GNI / External debt: ${fmt(c.external_debt_gni_pct, "%")} (警戒线 > 60%)
- 💵 GDP: ${fmt(c.gdp_billion_usd, " B USD")}

【任务 / Task】请用标准 Markdown 撰写一份深度风险研报：
1. 🚩 核心定性（若为模拟请强调这是推演）
2. 🔍 深度归因（通胀与债务对社会的具体冲击）
3. 💡 三条具体建议`;
}
