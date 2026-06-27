"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import RiskMap from "@/components/RiskMap";
import DataTable from "@/components/DataTable";
import ColumnMapping from "@/components/ColumnMapping";
import MarkdownView from "@/components/MarkdownView";
import { autoMap, missingRequired, normalize, labelFor, Mapping } from "@/lib/schema";
import { offlineReport, buildPrompt, ReportContext } from "@/lib/offlineReport";
import { Country, Sim } from "@/lib/types";
import { PROVIDER_PRESETS, ProviderConfig, defaultConfigs, presetById } from "@/lib/providers";

type Source = "demo" | "upload" | "db";
type Theme = "light" | "dark";

export default function Page() {
  const [source, setSource] = useState<Source>("demo");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});

  const [minRisk, setMinRisk] = useState(0);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [sim, setSim] = useState<Sim>({ inflation: 0, debt: 0 });

  // AI: a chosen provider id plus a per-provider config so switching never
  // clobbers another provider's key/baseUrl/model.
  const [provider, setProvider] = useState<string>("offline");
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>(() => defaultConfigs());

  const [theme, setTheme] = useState<Theme>("dark");

  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [conn, setConn] = useState("");
  const [table, setTable] = useState("countries");
  const [dbQuery, setDbQuery] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sync theme state with the class the pre-paint script already applied.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    // Read the truth from the DOM class (set pre-paint) so the toggle is
    // correct even before the sync effect has reconciled `theme`.
    const root = document.documentElement;
    const next: Theme = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("grw-theme", next);
    } catch {
      /* storage unavailable — ignore */
    }
    setTheme(next);
  };

  const updateCfg = (patch: Partial<ProviderConfig>) =>
    setConfigs((c) => ({ ...c, [provider]: { ...c[provider], ...patch } }));

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
    if (provider === "offline") {
      setReport(offlineReport(ctx));
      return;
    }
    const cfg = configs[provider];
    if (!cfg?.baseUrl || !cfg?.apiKey) {
      setReportError("请填写 Base URL 与 API Key，或切换到 offline。");
      return;
    }
    setReportLoading(true);
    setReport("");
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(ctx), ai: cfg }),
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
    r.startsWith("A")
      ? "text-emerald-600 dark:text-emerald-400"
      : r.startsWith("B")
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">🌍 Global Risk Watch</h1>
            <p className="text-xs text-muted">宏观风险预警 · Next.js demo</p>
          </div>
          <button
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label="切换浅色 / 深色主题 / Toggle light or dark theme"
            title="切换主题 / Toggle theme"
            className="shrink-0 rounded-lg border border-edge bg-panel p-2 text-fg/80 hover:bg-hover/10"
          >
            {/* Both icons render identically on server & client; CSS (the .dark
                class set pre-paint) picks which is visible — no flash, no mismatch. */}
            <span className="hidden dark:block">
              <SunIcon />
            </span>
            <span className="block dark:hidden">
              <MoonIcon />
            </span>
          </button>
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
                  source === s ? "bg-accent text-white" : "bg-ink text-fg/70 hover:bg-hover/10"
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
                className="block w-full text-xs text-fg/80 file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-white"
              />
              <p className="text-[11px] text-muted/80">需含 ISO-3 代码列。Needs an ISO-3 code column.</p>
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
                className="w-full rounded bg-accent px-2 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {dbLoading ? "连接中…" : "🔌 连接 / Connect"}
              </button>
              {dbError && <p className="text-[11px] text-red-500 dark:text-red-400">{dbError}</p>}
              <p className="text-[11px] text-muted/80">
                仅支持可被服务器访问的 Postgres（如 Neon / Supabase）。连接串不会被保存。
              </p>
            </div>
          )}

          {columns.length > 0 && (source === "upload" || source === "db") && (
            <ColumnMapping columns={columns} mapping={mapping} onChange={setMapping} />
          )}
          {notice && <p className="text-[11px] text-amber-600 dark:text-amber-400">{notice}</p>}
        </section>

        {/* AI settings */}
        <section className="space-y-2 rounded-lg border border-edge bg-panel p-3">
          <h2 className="text-sm font-semibold">🤖 AI 设置 / AI settings</h2>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
          >
            <option value="offline">offline · 离线模板（零配置）</option>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {provider !== "offline" &&
            (() => {
              const cfg = configs[provider];
              const preset = presetById(provider);
              return (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Base URL，如 https://api.deepseek.com/v1"
                    value={cfg.baseUrl}
                    onChange={(e) => updateCfg({ baseUrl: e.target.value })}
                    className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="模型，如 deepseek-chat"
                    value={cfg.model}
                    onChange={(e) => updateCfg({ model: e.target.value })}
                    className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
                  />
                  <input
                    type="password"
                    placeholder="API Key"
                    value={cfg.apiKey}
                    onChange={(e) => updateCfg({ apiKey: e.target.value })}
                    className="w-full rounded border border-edge bg-ink px-2 py-1 text-xs"
                  />
                  <p className="text-[11px] text-muted/80">
                    {preset?.hint} Key 仅用于本次请求转发，不会被保存。
                    {preset?.keyUrl && (
                      <>
                        {" "}
                        <a className="text-sky-500" href={preset.keyUrl} target="_blank" rel="noreferrer">
                          获取 Key ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
              );
            })()}
        </section>

        {/* Filter */}
        <section className="space-y-1 rounded-lg border border-edge bg-panel p-3">
          <h2 className="text-sm font-semibold">⚠️ 过滤 / Filter</h2>
          <label className="text-xs text-muted">最低风险分 / Min risk: {minRisk}</label>
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
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
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
                      <label className="text-xs text-muted">假设通胀率 / Inflation: {sim.inflation}%</label>
                      <input type="range" min={0} max={500} step={0.5} value={sim.inflation}
                        onChange={(e) => setSim({ ...sim, inflation: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                      <label className="text-xs text-muted">假设外债率 / External debt: {sim.debt}%</label>
                      <input type="range" min={0} max={300} step={0.5} value={sim.debt}
                        onChange={(e) => setSim({ ...sim, debt: Number(e.target.value) })} className="w-full" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={generate}
                      disabled={reportLoading}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {reportLoading ? "生成中…" : isModified ? "🧪 运行沙盘推演" : "🚀 生成深度研报"}
                    </button>
                    {isModified && (
                      <button
                        onClick={() => setSim({ inflation: realInf ?? 0, debt: realDebt ?? 0 })}
                        className="rounded-lg border border-edge px-3 py-2 text-sm text-fg/80 hover:bg-hover/10"
                      >
                        🔙 重置
                      </button>
                    )}
                    {isModified && <span className="text-xs text-amber-600 dark:text-amber-400">🔥 沙盘模拟模式</span>}
                  </div>
                  {reportError && <p className="text-xs text-red-500 dark:text-red-400">{reportError}</p>}
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
                    className="mt-3 rounded border border-edge px-3 py-1.5 text-xs text-fg/80 hover:bg-hover/10"
                  >
                    📥 下载报告 / Download
                  </button>
                </div>
              )}
            </section>

            <footer className="pb-6 text-center text-[11px] text-muted/70">
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
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`text-lg font-semibold ${className ?? ""}`}>{value}</div>
      {delta && <div className="text-[11px] text-muted">Δ {delta}</div>}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
