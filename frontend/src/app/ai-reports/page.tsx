"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, BarChart3, Clock, FileText, Loader2, Printer, Sparkles, Wand2, X } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { ReportData, ReportView } from "@/components/reports/ReportView";

interface QueryResponse {
  prompt: string;
  interpretation: string;
  report_type: string;
  ai_used: boolean;
  warnings: string[];
  report: ReportData;
  generated_at: string;
}

interface Context {
  salespeople: string[];
  sources: string[];
  courses: string[];
  statuses: string[];
  examples: string[];
  ai_enabled: boolean;
}

const HISTORY_KEY = "crm_ai_report_history";
const FALLBACK_EXAMPLES = [
  "Overall performance summary for the last 30 days",
  "Compare all salespeople this month by conversions",
  "Lead source report for last week",
  "Daily activity report of every salesperson today",
  "Revenue and collections by salesperson this month",
  "Lead pipeline funnel for all time",
];

export default function AIReportsPage() {
  const { role, user } = useRole();
  const allowed = ["Admin", "SuperAdmin", "SalesManager", "Demo"].includes(role);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const userStr = typeof window !== "undefined" ? (localStorage.getItem("crm_user") || localStorage.getItem("user")) : null;
    let userId: string | null = user?.id ? String(user.id) : null;
    let tenantId: string | null = null;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u?.id) userId = String(u.id);
        if (u?.tenant_id && u?.role !== "SuperAdmin") tenantId = String(u.tenant_id);
      } catch {}
    }
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userId ? { "X-User-ID": userId } : {}),
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    };
  };

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {}
    const p = new URLSearchParams();
    if (user?.id) p.set("user_id", String(user.id));
    fetch(`${API_BASE_URL}/ai-reports/context?${p.toString()}`, {
      headers: getAuthHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCtx(d))
      .catch(() => {});
  }, [user]);

  const remember = (p: string) => {
    const next = [p, ...history.filter((h) => h !== p)].slice(0, 8);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  };

  const run = useCallback(
    async (text?: string) => {
      const q = (text ?? prompt).trim();
      if (q.length < 3 || loading) return;
      setPrompt(q);
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/ai-reports/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            prompt: q,
            tz_offset_minutes: -new Date().getTimezoneOffset(),
            user_id: user?.id,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.message || "Could not generate the report");
        setResult(data);
        remember(q);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate the report");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt, loading, history, user]
  );

  const examples = (ctx?.examples?.length ? ctx.examples : FALLBACK_EXAMPLES).slice(0, 8);
  const personChips = (ctx?.salespeople || []).slice(0, 4).map((n) => `Performance of ${n} this month`);
  const sourceChips = (ctx?.sources || []).slice(0, 2).map((s) => `Leads and conversions from ${s} in the last 30 days`);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {!allowed && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          AI Reports is available to Admins and Sales Managers. Open <a href="/my-reports" className="underline">My Reports</a> to see your own numbers.
        </div>
      )}
      {/* Hero / prompt */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-6 shadow-xl dark:border-zinc-800 sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
            <Sparkles className="h-3.5 w-3.5" /> AI Reports
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">Ask for any report. Get it instantly.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Describe what you need in plain English — any salesperson, any date range, lead sources, conversions, revenue, activity.
            Every number comes straight from your CRM.
          </p>

          <div className="mt-6 rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-white/20 backdrop-blur dark:bg-zinc-900/95">
            <textarea
              id="ai-report-prompt"
              ref={inputRef}
              value={prompt}
              rows={2}
              maxLength={1000}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  run();
                }
              }}
              placeholder="e.g. Compare Ravi and Priya between 1 Oct and 15 Oct — leads, conversions and revenue by source"
              className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1">
              <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                <Wand2 className="h-3 w-3" />
                {ctx ? (ctx.ai_enabled ? "AI-powered understanding" : "Smart keyword understanding") : "Press Enter to generate"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {prompt && (
                  <button onClick={() => setPrompt("")} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800" title="Clear">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  id="ai-report-generate"
                  onClick={() => run()}
                  disabled={loading || prompt.trim().length < 3}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  {loading ? "Building report…" : "Generate report"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[...examples, ...personChips.slice(0, 2), ...sourceChips.slice(0, 1)].map((ex) => (
              <button
                key={ex}
                onClick={() => run(ex)}
                disabled={loading}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-white disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Recent
          </span>
          {history.map((h) => (
            <button
              key={h}
              onClick={() => run(h)}
              className="max-w-xs truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              title={h}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />
          ))}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-zinc-700">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-bold text-slate-700 dark:text-zinc-200">Your report will appear here</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Try “lead source report for last week”, “top 5 salespeople by admissions this month”, or “list all leads created yesterday”.
          </p>
        </div>
      )}

      {result && (
        <div ref={resultRef} className={`space-y-5 scroll-mt-6 transition ${loading ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">You asked</p>
              <p className="text-sm font-semibold italic text-slate-600 dark:text-zinc-300">“{result.prompt}”</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">{result.report.title}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <FileText className="h-3.5 w-3.5" /> {result.interpretation}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${result.ai_used ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  {result.ai_used ? "AI interpreted" : "Rule interpreted"}
                </span>
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
          </div>

          {result.warnings?.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              {result.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}

          <ReportView report={result.report} />
        </div>
      )}
    </div>
  );
}
