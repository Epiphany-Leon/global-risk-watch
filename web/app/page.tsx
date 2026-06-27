"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import RiskMap from "@/components/RiskMap";
import DataTable from "@/components/DataTable";
import ColumnMapping from "@/components/ColumnMapping";
import MarkdownView from "@/components/MarkdownView";
import { autoMap, missingRequired, normalize, labelFor, Mapping } from "@/lib/schema";
import { offlineReport, buildPrompt, ReportContext } from "@/lib/offlineReport";
import { AiConfig, Country, Sim } from "@/lib/types";

type Source = "demo" | "upload" | "db";

export default function Page() {
  const [source, setSource] = useState<Source>("demo");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});

  const [minRisk, setMinRisk] = useState(0);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [sim, setSim] = useState<Sim>({ inflation: 0, debt: 0 });

  const [ai, setAi] = useState<AiConfig>({ provider: "offline", model: "deepseek-chat", baseUrl: "", apiKey: "" });

  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [conn, setConn] = useState("");
  const [table, setTable] = useState("countries");
  const [dbQuery, setDbQuery] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ingest = useCallback((rows: Record<string, unknown>[]) => {
    const cols = rows.length ? Object.keys(rows[0]) : [];
    setRawRows(rows);
    setColumns(cols);
    setMapping(autoMap(cols));
  }, []);

  // Load the bundled demo dataset on first render.
  useEffect(() => {
    fetch("/demo_countries.json")
      .then((r) => r.json())
      .then((rows: Record<string, unknown>[]) => ingest(rows))
      .catch((e) => setNotice("演示数据加载失败 / demo load failed: " + String(e)));
  }, [ingest]);

  const rows: Country[] = useMemo(() => normalize(rawRows, mapping), [rawRows, mapping]);
  const missing = useMemo(() => missingRequired(rows), [rows]);

  const sortedByRisk = useMemo(
    () => [...rows].sort((a, b) => b.risk_score - a.risk_score),
    [rows]
  );

  // Keep a valid selection; default to the highest-risk country.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIso(null);
      return;
    }
    if (!selectedIso || !rows.some((r) => r.iso_code === selectedIso)) {
      setSelectedIso(sortedByRisk[0]?.iso_code ?? null);
    }
  }, [rows, sortedByRisk, selectedIso]);

  const selected = useMemo(
    () => rows.find((r) => r.iso_code === selectedIso) ?? null,
    [rows, selectedIso]
  );

  const realInf = selected?.inflation_rate ?? 0;
  const realDebt = selected?.external_debt_gni_pct ?? 0;

  // Reset the sandbox to the selected country's real values when it changes.
  useEffect(() => {
    setSim({ inflation: realInf ?? 0, debt: realDebt ?? 0 });
  }, [selectedIso, realInf, realDebt]);

  const isModified = sim.inflation !== (realInf ?? 0) || sim.debt !== (realDebt ?? 0);

  const onUpload = (file: File) => {
    setNotice(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      setNotice("浏览器内仅支持 CSV，请先导出为 CSV / In-browser supports CSV; export Excel to CSV first.");
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as Record<string, unknown>[];
        if (!data.length) {
          setNotice("文件为空或无法解析 / Empty or unparseable file.");
          return;
        }
        ingest(data);
      },
      error: (err: Error) => setNotice("解析失败 / Parse error: " + err.message),
    });
  };

  const connectDb = async () => {
    setDbError(null);
    setDbLoading(true);
    try {
      const resp = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: conn, table, query: dbQuery }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      if (!Array.isArray(data.rows) || data.rows.length === 0) throw new Error("查询无数据 / No rows returned.");
      ingest(data.rows);
    } catch (e) {
      setDbError(String((e as Error).message ?? e));
    } finally {
      setDbLoading(false);
    }
  };

  const buildContext = (): ReportContext => {
    const inflation = isModified ? sim.inflation : selected?.inflation_rate ?? null;
    const debt = isModified ? sim.debt : selected?.external_debt_gni_pct ?? null;
    return {
      country: selected?.country ?? "—",
      iso_code: selected?.iso_code ?? "—",
      risk_rating: selected?.risk_rating ?? "NR",
      risk_score: selected?.risk_score ?? null,
      inflation_rate: inflation,
      external_debt_gni_pct: debt,
      gdp_billion_usd: selected?.gdp_billion_usd ?? null,
      is_sim: isModified,
    };
  };

  const generate = async () => {
    if (!selected) return;
    setReportError(null);
    const ctx = buildContext();
    if (ai.provider === "offline") {
      setReport(offlineReport(ctx));
      return;
    }
    if (!ai.baseUrl || !ai.apiKey) {
      setReportError("请填写 Base URL 与 API Key，或切换到 offline。");
      return;
    }
    setReportLoading(true);
    setReport("");
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(ctx), ai }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? `HTTP ${resp.status}`);
      setReport(data.report);
    } catch (e) {
      setReportError(String((e as Error).message ?? e));
    } finally {
      setReportLoading(false);
    }
  };

  const switchSource = (s: Source) => {
    setSource(s);
    setNotice(null);
    if (s === "demo") {
      fetch("/demo_countries.json")
        .then((r) => r.json())
        .then((r: Record<string, unknown>[]) => ingest(r));
    } else if (s === "upload") {
      setRawRows([]);
      setColumns([]);
    } else {
      setRawRows([]);
      setColumns([]);
    }
  };

  const ratingColor = (r: string) =>
    r.startsWith("A") ? "text-emerald-400" : r.startsWith("B") ? "text-amber-400" : "text-red-400";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div>
          <h1 className="text-xl font-bold">🌍 Global Risk Watch</h1>
          <p className="text-xs text-gray-400">宏观风险预警 · Next.js demo</p>
        </div>

        {/* Data source */}
        <section className="space-y-2 rounded-lg border border-edge bg-panel p-3">
          <h2 className="text-sm font-semibold">📥 数据源 / Data source</h2>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {(["demo", "upload", "db"] as Source[]).map((s) => (
              <button
                key={s}
                onClick={() => switchSource(s)}
                className={`rounded px-2 py-1.5 ${
                  source === s ? "bg-[#E45756] text-white" : "bg-ink text-gray-300 hover:bg-white/5"
                }`}
              >
                {s === "demo" ? "演示" : s === "upload" ? "上传" : "数据库"}
              </button>
            ))}
          </div>

          {source === "upload" && (
            <div className="space-y-1">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                className="block w-full text-xs text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-[#E45756] file:px-2 file:py-1 file:text-white"
              />
              <p className="text-[11px] text-gray-500">需含 ISO-3 代码列。Needs an ISO-3 code column.</p>
            </div>
          )}

          {source === "db" && (
            <div className="space-y-1.5">
              <input
                type="password"
                placeholder="postgres://user:pass@host:5432/db"
                value={conn}
                onChange={(e) => setConn(e.target.value)}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <input
                type="text"
                placeholder="表名 / table"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <input
                type="text"
                placeholder="自定义 SELECT（可选）"
                value={dbQuery}
                onChange={(e) => setDbQuery(e.target.value)}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <button
                onClick={connectDb}
                disabled={dbLoading}
                className="w-full rounded bg-[#E45756] px-2 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {dbLoading ? "连接中…" : "🔌 连接 / Connect"}
              </button>
              {dbError && <p className="text-[11px] text-red-400">{dbError}</p>}
              <p className="text-[11px] text-gray-500">
                仅支持可被服务器访问的 Postgres（如 Neon / Supabase）。连接串不会被保存。
              </p>
            </div>
          )}

          {columns.length > 0 && (source === "upload" || source === "db") && (
            <ColumnMapping columns={columns} mapping={mapping} onChange={setMapping} />
          )}
          {notice && <p className="text-[11px] text-amber-400">{notice}</p>}
        </section>

        {/* AI settings */}
        <section className="space-y-2 rounded-lg border border-edge bg-panel p-3">
          <h2 className="text-sm font-semibold">🤖 AI 设置 / AI settings</h2>
          <select
            value={ai.provider}
            onChange={(e) => setAi({ ...ai, provider: e.target.value as AiConfig["provider"] })}
            className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
          >
            <option value="offline">offline · 离线模板（零配置）</option>
            <option value="openai">openai · OpenAI / DeepSeek 兼容 API</option>
          </select>
          {ai.provider === "openai" && (
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Base URL，如 https://api.deepseek.com/v1"
                value={ai.baseUrl}
                onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <input
                type="text"
                placeholder="模型，如 deepseek-chat"
                value={ai.model}
                onChange={(e) => setAi({ ...ai, model: e.target.value })}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <input
                type="password"
                placeholder="API Key"
                value={ai.apiKey}
                onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
                className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
              />
              <p className="text-[11px] text-gray-500">Key 仅用于本次请求转发，不会被保存。</p>
            </div>
          )}
        </section>

        {/* Filter */}
        <section className="space-y-1 rounded-lg border border-edge bg-panel p-3">
          <h2 className="text-sm font-semibold">⚠️ 过滤 / Filter</h2>
          <label className="text-xs text-gray-400">最低风险分 / Min risk: {minRisk}</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
            className="w-full"
          />
        </section>
      </aside>

      {/* Main */}
      <main className="flex-1 space-y-4">
        {missing.length > 0 ? (
          <div className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-300">
            数据缺少必填列：{missing.map(labelFor).join("、")}。请在「列映射」中指定。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <div className="rounded-xl border border-edge bg-panel p-3 xl:col-span-3">
                <h2 className="mb-2 text-sm font-semibold">📍 风险热力图 / Heatmap（risk ≥ {minRisk}）</h2>
                <RiskMap rows={rows} minRisk={minRisk} selectedIso={selectedIso} onSelect={setSelectedIso} />
              </div>
              <div className="rounded-xl border border-edge bg-panel p-3 xl:col-span-2">
                <h2 className="mb-2 text-sm font-semibold">📊 数据 / Data（{rows.filter((r) => r.risk_score >= minRisk).length}）</h2>
                <DataTable
                  rows={rows.filter((r) => r.risk_score >= minRisk)}
                  selectedIso={selectedIso}
                  onSelect={setSelectedIso}
                />
              </div>
            </div>

            {/* Analysis */}
            <section className="space-y-3 rounded-xl border border-edge bg-panel p-4">
              <h2 className="text-sm font-semibold">🧠 智能战略分析 / Analysis：{selected?.country ?? "—"}</h2>

              {selected && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label="评级 / Rating" value={selected.risk_rating} className={ratingColor(selected.risk_rating)} />
                    <Metric label="风险分 / Score" value={String(selected.risk_score)} />
                    <Metric
                      label="通胀 (模拟)"
                      value={`${sim.inflation}%`}
                      delta={`${(sim.inflation - (realInf ?? 0)).toFixed(1)}%`}
                    />
                    <Metric
                      label="外债 (模拟)"
                      value={`${sim.debt}%`}
                      delta={`${(sim.debt - (realDebt ?? 0)).toFixed(1)}%`}
                    />
                  </div>

                  {/* Sandbox */}
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-edge bg-ink/50 p-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-gray-400">假设通胀率 / Inflation: {sim.inflation}%</label>
                      <input type="range" min={0} max={500} step={0.5} value={sim.inflation}
                        onChange={(e) => setSim({ ...sim, inflation: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">假设外债率 / External debt: {sim.debt}%</label>
                      <input type="range" min={0} max={300} step={0.5} value={sim.debt}
                        onChange={(e) => setSim({ ...sim, debt: Number(e.target.value) })} className="w-full" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={generate}
                      disabled={reportLoading}
                      className="rounded-lg bg-[#E45756] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {reportLoading ? "生成中…" : isModified ? "🧪 运行沙盘推演" : "🚀 生成深度研报"}
                    </button>
                    {isModified && (
                      <button
                        onClick={() => setSim({ inflation: realInf ?? 0, debt: realDebt ?? 0 })}
                        className="rounded-lg border border-edge px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                      >
                        🔙 重置
                      </button>
                    )}
                    {isModified && <span className="text-xs text-amber-400">🔥 沙盘模拟模式</span>}
                  </div>
                  {reportError && <p className="text-xs text-red-400">{reportError}</p>}
                </>
              )}

              {report && (
                <div className="rounded-lg border border-edge bg-ink/40 p-4">
                  <MarkdownView>{report}</MarkdownView>
                  <button
                    onClick={() => {
                      const blob = new Blob([report], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${selected?.country ?? "report"}_risk_report.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="mt-3 rounded border border-edge px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
                  >
                    📥 下载报告 / Download
                  </button>
                </div>
              )}
            </section>

            <footer className="pb-6 text-center text-[11px] text-gray-600">
              演示数据与默认风险模型仅供展示，非投资建议 · Illustrative demo, not investment advice ·{" "}
              <a className="text-sky-500" href="https://github.com/Epiphany-Leon/global-risk-watch">
                GitHub
              </a>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-edge bg-ink/50 p-2.5">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${className ?? ""}`}>{value}</div>
      {delta && <div className="text-[11px] text-gray-500">Δ {delta}</div>}
    </div>
  );
}
