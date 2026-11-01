"use client";

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Lightbulb, Search, Sparkles } from "lucide-react";

// ── Types shared by AI Reports and My Reports ───────────────────────────────
export interface ReportKpi {
  key: string;
  label: string;
  value: number;
  type: "int" | "money" | "pct" | "text";
  hint?: string;
}
export interface ReportColumn {
  key: string;
  label: string;
  type: "int" | "money" | "pct" | "text";
}
export interface ReportTable {
  id: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, any> | null;
}
export interface ReportChart {
  id: string;
  title: string;
  type: "bar" | "pie" | "area";
  series: { key: string; label: string }[];
  data: Record<string, any>[];
}
export interface ReportData {
  title: string;
  range: { start: string; end: string; all_time: boolean; label: string };
  kpis: ReportKpi[];
  tables: ReportTable[];
  charts: ReportChart[];
  insights: string[];
  summary?: string;
}

export const CHART_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316", "#64748b", "#84cc16"];

export function formatValue(value: any, type: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  if (type === "pct") return `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
  if (type === "int") return Number(value).toLocaleString("en-IN");
  return String(value);
}

// ── KPI cards ───────────────────────────────────────────────────────────────
const KPI_ACCENTS = [
  "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
  "from-indigo-500/15 to-indigo-500/0 text-indigo-600 dark:text-indigo-400",
  "from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400",
  "from-pink-500/15 to-pink-500/0 text-pink-600 dark:text-pink-400",
  "from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-400",
  "from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400",
];

export function KpiGrid({ kpis }: { kpis: ReportKpi[] }) {
  if (!kpis?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={k.key}
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 ${KPI_ACCENTS[i % KPI_ACCENTS.length].split(" text-")[0]}`} />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`mt-1.5 text-2xl font-black tracking-tight ${KPI_ACCENTS[i % KPI_ACCENTS.length].split(" ").slice(2).join(" ")}`}>
              {formatValue(k.value, k.type)}
            </p>
            {k.hint ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{k.hint}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────────
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(15,23,42,0.94)",
  color: "#f8fafc",
  fontSize: 12,
};

export function ChartCard({ chart }: { chart: ReportChart }) {
  const hasMoney = chart.series.some((s) => /₹|collected|tuition|due/i.test(s.label + s.key));
  const fmt = (v: any) => (hasMoney ? `₹${Number(v).toLocaleString("en-IN")}` : Number(v).toLocaleString("en-IN"));
  const longLabels = chart.data.some((d) => String(d.label).length > 10);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-white">{chart.title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "pie" ? (
            <PieChart>
              <Pie data={chart.data} dataKey={chart.series[0].key} nameKey="label" innerRadius={48} outerRadius={86} paddingAngle={2}>
                {chart.data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chart.type === "area" ? (
            <AreaChart data={chart.data} margin={{ left: -12, right: 8, top: 6 }}>
              <defs>
                {chart.series.map((s, i) => (
                  <linearGradient key={s.key} id={`grad-${chart.id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {chart.series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${chart.id}-${s.key})`}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={chart.data} margin={{ left: -12, right: 8, top: 6, bottom: longLabels ? 24 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                interval={0}
                angle={longLabels ? -20 : 0}
                textAnchor={longLabels ? "end" : "middle"}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {chart.series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={44} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────
export function downloadTableCsv(table: ReportTable, filename?: string) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [table.columns.map((c) => esc(c.label)).join(",")];
  table.rows.forEach((r) => lines.push(table.columns.map((c) => esc(r[c.key])).join(",")));
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(filename || table.title).replace(/[^\w-]+/g, "_").toLowerCase()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataTable({ table, maxHeight = 460 }: { table: ReportTable; maxHeight?: number }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [asc, setAsc] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    let r = table.rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((row) => table.columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q)));
    }
    if (sortKey) {
      const col = table.columns.find((c) => c.key === sortKey);
      const numeric = col && col.type !== "text";
      r = [...r].sort((a, b) => {
        const av = a[sortKey!], bv = b[sortKey!];
        const cmp = numeric ? Number(av ?? 0) - Number(bv ?? 0) : String(av ?? "").localeCompare(String(bv ?? ""));
        return asc ? cmp : -cmp;
      });
    }
    return r;
  }, [table, sortKey, asc, query]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">{table.title}</h3>
        <div className="flex items-center gap-2">
          {table.rows.length > 6 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="w-28 bg-transparent text-xs text-slate-700 focus:outline-none dark:text-zinc-200"
              />
            </div>
          )}
          <button
            onClick={() => downloadTableCsv(table)}
            disabled={!table.rows.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>
      {table.rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">No data for this selection.</p>
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full min-w-max text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-zinc-800">
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`cursor-pointer select-none whitespace-nowrap px-4 py-2.5 font-bold uppercase tracking-wide text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white ${c.type !== "text" ? "text-right" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rows.map((row, i) => (
                <tr key={i} className="transition hover:bg-emerald-50/50 dark:hover:bg-zinc-800/60">
                  {table.columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 ${c.type !== "text" ? "text-right tabular-nums" : ""} ${ci === 0 ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-zinc-300"} ${c.key === "summary" ? "min-w-[280px] whitespace-normal" : "whitespace-nowrap"}`}
                    >
                      {formatValue(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.totals && !query && (
              <tfoot className="sticky bottom-0 bg-slate-50 font-black dark:bg-zinc-800">
                <tr>
                  {table.columns.map((c, ci) => (
                    <td key={c.key} className={`px-4 py-2.5 text-slate-900 dark:text-white ${c.type !== "text" ? "text-right tabular-nums" : ""}`}>
                      {ci === 0 ? "Total" : table.totals![c.key] !== undefined ? formatValue(table.totals![c.key], c.type) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ── Full report ─────────────────────────────────────────────────────────────
export function ReportView({ report, showKpis = true }: { report: ReportData; showKpis?: boolean }) {
  return (
    <div className="space-y-5">
      {report.summary ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/30">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            <Sparkles className="h-3 w-3" /> AI readout
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-200">{report.summary}</p>
        </div>
      ) : null}

      {showKpis && <KpiGrid kpis={report.kpis} />}

      {report.insights?.length ? (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Lightbulb className="h-3.5 w-3.5" /> Key insights
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-zinc-300">
            {report.insights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.charts?.length ? (
        <div className={`grid gap-5 ${report.charts.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {report.charts.map((c) => (
            <ChartCard key={c.id} chart={c} />
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        {report.tables.map((t) => (
          <DataTable key={t.id} table={t} />
        ))}
      </div>
    </div>
  );
}
