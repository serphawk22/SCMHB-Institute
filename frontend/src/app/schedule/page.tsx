"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock, CalendarCheck, Video, PhoneCall, Phone, Mail, UserRound, Loader2, Check,
  RotateCcw, XCircle, ExternalLink, AlertTriangle, GraduationCap, ArrowUpRight, MapPin, UserX,
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import LeadScheduleModal, { SchedulePayload } from "@/components/LeadScheduleModal";

type Kind = "all" | "demo" | "followup" | "walkin";

interface ScheduleItem {
  id: number;
  type: "demo" | "followup" | "walkin";
  lead_id: number;
  lead_name: string;
  phone?: string | null;
  email?: string | null;
  course?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  scheduled_at: string;
  status: string;
  notes?: string | null;
  meeting_url?: string | null;
  location?: string | null;
}

const GROUPS = ["Overdue", "Today", "Tomorrow", "This week", "Later"] as const;
type Group = typeof GROUPS[number];

const GROUP_STYLE: Record<Group, string> = {
  Overdue: "text-red-600 dark:text-red-400",
  Today: "text-emerald-600 dark:text-emerald-400",
  Tomorrow: "text-blue-600 dark:text-blue-400",
  "This week": "text-violet-600 dark:text-violet-400",
  Later: "text-slate-500 dark:text-slate-400",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupOf(iso: string): Group {
  const when = new Date(iso);
  const now = new Date();
  if (when.getTime() < now.getTime()) return "Overdue";
  const days = Math.round((startOfDay(when).getTime() - startOfDay(now).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return "This week";
  return "Later";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function SchedulePage() {
  const { role } = useRole();
  const router = useRouter();
  const isAdmin = role === "Admin" || (role as string) === "SuperAdmin";

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<ScheduleItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role && !["Admin", "Employee", "Intern", "SalesManager", "Demo"].includes(role as string) && !isAdmin) {
      router.replace("/");
    }
  }, [role, isAdmin, router]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/schedule/upcoming`);
      if (!res.ok) throw new Error("Could not load the schedule.");
      setItems((await res.json()).items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => items
      .filter(i => kind === "all" || i.type === kind)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [items, kind],
  );

  const grouped = useMemo(() => {
    const map = new Map<Group, ScheduleItem[]>();
    visible.forEach(i => {
      const g = groupOf(i.scheduled_at);
      map.set(g, [...(map.get(g) || []), i]);
    });
    return GROUPS.filter(g => map.has(g)).map(g => ({ group: g, rows: map.get(g)! }));
  }, [visible]);

  const counts = useMemo(() => ({
    all: items.length,
    demo: items.filter(i => i.type === "demo").length,
    followup: items.filter(i => i.type === "followup").length,
    walkin: items.filter(i => i.type === "walkin").length,
    today: items.filter(i => groupOf(i.scheduled_at) === "Today").length,
    overdue: items.filter(i => groupOf(i.scheduled_at) === "Overdue").length,
  }), [items]);

  const endpoint = (item: ScheduleItem) => {
    if (item.type === "demo") return `${API_BASE_URL}/lead-demo-sessions/${item.id}`;
    if (item.type === "walkin") return `${API_BASE_URL}/lead-walk-ins/${item.id}`;
    return `${API_BASE_URL}/lead-follow-ups/${item.id}`;
  };

  const patch = async (item: ScheduleItem, body: Record<string, unknown>) => {
    const res = await fetch(endpoint(item), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(typeof d?.detail === "string" ? d.detail : "Update failed.");
    }
  };

  const act = async (item: ScheduleItem, kindOfAction: "done" | "not_attended" | "cancel") => {
    const itemLabel = item.type === "demo" ? "demo" : item.type === "walkin" ? "walk-in" : "follow-up";
    if (kindOfAction === "cancel" && !confirm(`Cancel this ${itemLabel} for ${item.lead_name}?`)) return;
    const key = `${item.type}-${item.id}`;
    setBusyKey(key);
    try {
      let status = "Done";
      if (kindOfAction === "not_attended") {
        status = "Not Attended";
      } else if (kindOfAction === "cancel") {
        status = "Cancelled";
      } else if (kindOfAction === "done") {
        status = (item.type === "demo" || item.type === "walkin") ? "Attended" : "Done";
      }
      await patch(item, { status });
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const submitReschedule = async (p: SchedulePayload) => {
    if (!reschedule) return;
    const body: Record<string, unknown> = { scheduled_at: p.scheduled_at, notes: p.notes || null };
    if (reschedule.type === "demo") body.meeting_url = p.meeting_url || null;
    if (reschedule.type === "walkin") body.location = p.location || "Campus Front Desk";
    await patch(reschedule, body);
    setReschedule(null);
    await load(true);
  };

  const tabs: { id: Kind; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "demo", label: "Demos", count: counts.demo },
    { id: "followup", label: "Follow-ups", count: counts.followup },
    { id: "walkin", label: "Walk-ins", count: counts.walkin },
  ];

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] dark:bg-black">
      <div className="border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-black">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 via-fuchsia-600 to-sky-600 p-2.5 text-white shadow-md">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Important Dates</h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {isAdmin ? "Everything scheduled across the sales team" : "Everything scheduled for your leads"} · Follow-ups, Demos &amp; Walk-ins · nearest first
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setKind(tab.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${kind === tab.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}>
                {tab.label} <span className="ml-1 text-xs opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {[
            { label: "Overdue", value: counts.overdue, color: "text-red-600", bg: "bg-red-500/10" },
            { label: "Today", value: counts.today, color: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: "Demos", value: counts.demo, color: "text-fuchsia-600", bg: "bg-fuchsia-500/10" },
            { label: "Follow-ups", value: counts.followup, color: "text-amber-600", bg: "bg-amber-500/10" },
            { label: "Walk-ins", value: counts.walkin, color: "text-sky-600", bg: "bg-sky-500/10" },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${s.bg}`}>
              <p className={`text-xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
            <button onClick={() => load()} className="ml-2 font-semibold underline">Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <CalendarCheck className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nothing scheduled</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Move a lead to <b>Follow-up</b>, <b>Demo</b>, or <b>Walk-in Scheduled</b> in <Link href="/leads" className="font-semibold text-blue-600 hover:underline">Student Leads</Link> and it will show up here.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-8">
            {grouped.map(({ group, rows }) => (
              <section key={group}>
                <h2 className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${GROUP_STYLE[group]}`}>
                  {group === "Overdue" && <AlertTriangle className="h-3.5 w-3.5" />}
                  {group} <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{rows.length}</span>
                </h2>
                <div className="space-y-3">
                  {rows.map(item => {
                    const key = `${item.type}-${item.id}`;
                    const isDemo = item.type === "demo";
                    const isWalkIn = item.type === "walkin";
                    const overdue = group === "Overdue";
                    const Icon = isDemo ? Video : isWalkIn ? MapPin : PhoneCall;
                    const busy = busyKey === key;
                    const badgeClass = isDemo
                      ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                      : isWalkIn
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
                    const dateBgClass = overdue
                      ? "bg-red-500/10 text-red-600"
                      : isDemo
                      ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                      : isWalkIn
                      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
                    return (
                      <motion.div key={key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-wrap items-stretch gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-950 ${overdue ? "border-red-200 dark:border-red-900/60" : "border-slate-200 dark:border-slate-800"}`}>
                        <div className={`flex w-24 shrink-0 flex-col items-center justify-center rounded-xl px-2 py-3 text-center ${dateBgClass}`}>
                          <Icon className="mb-1 h-5 w-5" />
                          <span className="text-[11px] font-semibold uppercase">{fmtDate(item.scheduled_at)}</span>
                          <span className="text-lg font-black leading-tight">{fmtTime(item.scheduled_at)}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/leads/${item.lead_id}`} className="group flex items-center gap-1 text-base font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                              {item.lead_name}
                              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Link>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badgeClass}`}>
                              {isDemo ? "Demo" : isWalkIn ? "Walk-in" : "Follow-up"}
                            </span>
                            {overdue && <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-red-600">Overdue</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
                            {item.course && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{item.course}</span>}
                            {isWalkIn && item.location && (
                              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                                <MapPin className="h-3.5 w-3.5" /> {item.location}
                              </span>
                            )}
                            {item.phone && <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600"><Phone className="h-3.5 w-3.5" />{item.phone}</a>}
                            {item.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{item.email}</span>}
                            {isAdmin && (
                              <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{item.owner_name || "Unassigned"}</span>
                            )}
                          </div>
                          {item.notes && <p className="mt-2 line-clamp-2 text-[13px] text-slate-600 dark:text-slate-300">{item.notes}</p>}
                          {item.meeting_url && (
                            <a href={item.meeting_url} target="_blank" rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-fuchsia-600 hover:underline">
                              <ExternalLink className="h-3.5 w-3.5" /> Join meeting
                            </a>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-center">
                          <button onClick={() => act(item, "done")} disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {(isDemo || isWalkIn) ? "Attended" : "Done"}
                          </button>
                          {(isDemo || isWalkIn) && (
                            <button onClick={() => act(item, "not_attended")} disabled={busy}
                              title={isDemo ? "Mark demo not attended" : "Mark walk-in not attended"}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-xs font-bold hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
                              <UserX className="h-3.5 w-3.5" /> Not Attended
                            </button>
                          )}
                          <button onClick={() => setReschedule(item)} disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                            <RotateCcw className="h-3.5 w-3.5" /> Reschedule
                          </button>
                          <button onClick={() => act(item, "cancel")} disabled={busy} title="Cancel"
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {reschedule && (
          <LeadScheduleModal
            key={`${reschedule.type}-${reschedule.id}`}
            type={reschedule.type}
            leadName={reschedule.lead_name}
            initial={{ scheduled_at: reschedule.scheduled_at, notes: reschedule.notes || "", meeting_url: reschedule.meeting_url || "", location: reschedule.location || "" }}
            submitLabel="Save new time"
            onClose={() => setReschedule(null)}
            onSubmit={submitReschedule}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
