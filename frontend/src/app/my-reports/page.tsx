"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  Loader2,
  PieChart as PieIcon,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { ChartCard, DataTable, KpiGrid, ReportChart, ReportKpi, ReportTable } from "@/components/reports/ReportView";

interface Section {
  tables: ReportTable[];
  charts: ReportChart[];
}
interface MyReport {
  user: { id: number; name: string; role: string };
  range: { start: string; end: string; all_time: boolean; label: string };
  kpis: ReportKpi[];
  insights: string[];
  sections: Record<"sources" | "pipeline" | "courses" | "leads" | "admissions" | "activity" | "tasksheet", Section>;
}
interface DailySummary {
  work_date: string;
  summary: string;
  proof_of_work: string;
  time_spent_minutes: number | null;
  stats: Record<string, number>;
  facts: string[];
  has_activity: boolean;
  ai_used: boolean;
  submitted: boolean;
  entry_id: number | null;
}

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "sources", label: "Lead Sources", icon: PieIcon },
  { id: "pipeline", label: "Pipeline", icon: Layers },
  { id: "leads", label: "My Leads", icon: Users },
  { id: "admissions", label: "Admissions", icon: GraduationCap },
  { id: "tasksheet", label: "Task Sheet", icon: ClipboardList },
] as const;

const iso = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const tzOffset = () => -new Date().getTimezoneOffset();

const STAT_LABELS: Record<string, string> = {
  lead: "New leads",
  call: "Calls",
  note: "Notes",
  followup: "Follow-ups",
  demo: "Demos",
  meeting: "Meetings",
  enrollment: "Admissions",
  activity: "Other",
};

export default function MyReportsPage() {
  const { user } = useRole();
  const today = iso(new Date());
  const [startDate, setStartDate] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [endDate, setEndDate] = useState(today);
  const [allTime, setAllTime] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [data, setData] = useState<MyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI daily summary state
  const [workDate, setWorkDate] = useState(today);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [draft, setDraft] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [sumError, setSumError] = useState("");

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({ tz_offset_minutes: String(tzOffset()) });
      if (user?.id) p.set("user_id", String(user.id));
      if (allTime) p.set("all_time", "true");
      else {
        p.set("start_date", startDate);
        p.set("end_date", endDate);
      }
      const res = await fetch(`${API_BASE_URL}/my-reports?${p.toString()}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Failed to load your reports");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your reports");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, allTime, user]);

  useEffect(() => {
    load();
  }, [load]);

  const preset = (kind: "today" | "week" | "month" | "all") => {
    setAllTime(kind === "all");
    const now = new Date();
    if (kind === "today") {
      setStartDate(iso(now));
      setEndDate(iso(now));
    } else if (kind === "week") {
      setStartDate(iso(new Date(Date.now() - 6 * 86400000)));
      setEndDate(iso(now));
    } else if (kind === "month") {
      setStartDate(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(iso(now));
    }
  };

  const generate = async (submit: boolean) => {
    setGenBusy(true);
    setSumError("");
    setSent(false);
    try {
      const res = await fetch(`${API_BASE_URL}/my-reports/daily-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          work_date: workDate,
          tz_offset_minutes: tzOffset(),
          submit,
          user_id: user?.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Could not generate the summary");
      setSummary(json);
      setDraft(json.summary);
      setSent(Boolean(json.submitted));
      if (submit && !json.has_activity) setSumError("No CRM activity found for that day, so nothing was sent to the Task Sheet.");
    } catch (e) {
      setSumError(e instanceof Error ? e.message : "Could not generate the summary");
    } finally {
      setGenBusy(false);
    }
  };

  const sendToTaskSheet = async () => {
    if (!summary || !draft.trim()) return;
    setSendBusy(true);
    setSumError("");
    try {
      const res = await fetch(`${API_BASE_URL}/my-reports/daily-summary/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          work_date: summary.work_date,
          summary: draft,
          proof_of_work: summary.proof_of_work,
          time_spent_minutes: summary.time_spent_minutes,
          user_id: user?.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Could not save to the Task Sheet");
      setSent(true);
      load();
    } catch (e) {
      setSumError(e instanceof Error ? e.message : "Could not save to the Task Sheet");
    } finally {
      setSendBusy(false);
    }
  };

  const sec = (k: keyof MyReport["sections"]) => data?.sections?.[k];
  const statChips = useMemo(
    () => Object.entries(summary?.stats || {}).filter(([k, v]) => STAT_LABELS[k] && v > 0),
    [summary]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <Target className="h-3.5 w-3.5" /> My Sales Reports
          </span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {user?.name ? `${user.name.split(" ")[0]}'s performance` : "My performance"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 sm:text-sm">
            The leads you received, where they came from, how many you converted and the revenue you closed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-900">
            {(
              [
                ["today", "Today"],
                ["week", "7 Days"],
                ["month", "This Month"],
                ["all", "All Time"],
              ] as const
            ).map(([k, label]) => {
              const active =
                k === "all"
                  ? allTime
                  : !allTime &&
                    ((k === "today" && startDate === today && endDate === today) ||
                      (k === "week" && startDate === iso(new Date(Date.now() - 6 * 86400000))) ||
                      (k === "month" && startDate === iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1))));
              return (
                <button
                  key={k}
                  onClick={() => preset(k)}
                  className={`rounded-lg px-2.5 py-1.5 transition ${active ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!allTime && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-800 focus:outline-none dark:text-zinc-200" />
              <span className="text-slate-400">to</span>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-800 focus:outline-none dark:text-zinc-200" />
            </div>
          )}
          <button onClick={load} disabled={loading} title="Refresh" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* AI daily summary → task sheet */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-teal-950/20 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">AI Daily Work Report</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Writes what you did from your real CRM activity (leads, calls, notes, demos, follow-ups, admissions) and sends it to your Task Sheet.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={workDate}
              max={today}
              onChange={(e) => {
                setWorkDate(e.target.value);
                setSummary(null);
                setSent(false);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              id="ai-daily-generate"
              onClick={() => generate(false)}
              disabled={genBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-emerald-400"
            >
              {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </button>
            <button
              id="ai-daily-generate-send"
              onClick={() => generate(true)}
              disabled={genBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Generate &amp; send
            </button>
          </div>
        </div>

        {sumError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> {sumError}
          </div>
        )}

        {summary && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {statChips.map(([k, v]) => (
                <span key={k} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                  {v} {STAT_LABELS[k].toLowerCase()}
                </span>
              ))}
              {summary.time_spent_minutes ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ≈ {summary.time_spent_minutes} min logged
                </span>
              ) : null}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${summary.ai_used ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {summary.ai_used ? "Written by AI" : "Auto-compiled"}
              </span>
            </div>

            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSent(false);
              }}
              rows={Math.min(12, Math.max(4, draft.split("\n").length + 1))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <p className="text-[11px] text-slate-400">{summary.proof_of_work}</p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                id="ai-daily-send"
                onClick={sendToTaskSheet}
                disabled={sendBusy || !draft.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
              >
                {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sent ? "Update Task Sheet entry" : "Send to Task Sheet"}
              </button>
              {sent && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Saved to your Task Sheet for {summary.work_date} —{" "}
                  <Link href="/task-sheet" className="underline">
                    view
                  </Link>
                </span>
              )}
              {!summary.has_activity && <span className="text-xs font-semibold text-amber-600">No CRM activity found for this day — edit the text before sending.</span>}
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-100 p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                tab === t.id ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400" : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : data ? (
        <div className={`space-y-5 transition ${loading ? "opacity-60" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{data.range.label}</p>
          <KpiGrid kpis={data.kpis} />

          {tab === "overview" && (
            <>
              {data.insights.length > 0 && (
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-slate-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-zinc-300">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Activity className="h-3.5 w-3.5" /> Highlights
                  </div>
                  <ul className="list-inside list-disc space-y-0.5">
                    {data.insights.map((i, n) => (
                      <li key={n}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-5 lg:grid-cols-2">
                {[...(sec("activity")?.charts || []), ...(sec("sources")?.charts || [])].map((c) => (
                  <ChartCard key={c.id + c.title} chart={c} />
                ))}
              </div>
              {sec("sources")?.tables.map((t) => (
                <DataTable key={t.id} table={t} />
              ))}
              {sec("courses")?.tables.map((t) => (
                <DataTable key={t.id} table={t} />
              ))}
            </>
          )}

          {tab === "sources" && (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                {sec("sources")?.charts.map((c) => (
                  <ChartCard key={c.id} chart={c} />
                ))}
              </div>
              {sec("sources")?.tables.map((t) => (
                <DataTable key={t.id} table={t} />
              ))}
              {sec("courses")?.tables.map((t) => (
                <DataTable key={t.id} table={t} />
              ))}
            </>
          )}

          {tab === "pipeline" && (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                {sec("pipeline")?.charts.map((c) => (
                  <ChartCard key={c.id} chart={c} />
                ))}
              </div>
              {sec("pipeline")?.tables.map((t) => (
                <DataTable key={t.id} table={t} />
              ))}
            </>
          )}

          {tab === "leads" && sec("leads")?.tables.map((t) => <DataTable key={t.id} table={t} maxHeight={560} />)}
          {tab === "admissions" && sec("admissions")?.tables.map((t) => <DataTable key={t.id} table={t} maxHeight={560} />)}
          {tab === "tasksheet" && sec("tasksheet")?.tables.map((t) => <DataTable key={t.id} table={t} maxHeight={560} />)}
        </div>
      ) : null}
    </div>
  );
}
