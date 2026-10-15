"use client";

import type { ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Users, UserPlus, PhoneCall, TrendingUp, TrendingDown,
  Target, DollarSign, Percent, Mail, Trophy, Minus,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import FollowUpsWidget from '@/components/followups/FollowUpsWidget';

interface Activity {
  type: string;
  title: string;
  date: string;
  status: string;
}

interface Trend {
  current: number;
  previous: number;
  change: number;
}

interface SalesManagerStats {
  metrics: {
    assigned_leads: number;
    assigned_contacts: number;
    assigned_clients: number;
    deals_won?: number;
    revenue_won?: number;
    conversion_percentage?: number;
    deal_win_rate?: number;
    calls_logged?: number;
    emails_sent?: number;
  };
  trends?: {
    leads?: Trend;
    calls?: Trend;
    emails?: Trend;
    deals_won?: Trend;
    revenue?: Trend;
  };
  charts?: {
    labels: string[];
    calls: number[];
    emails: number[];
    revenue: { name: string; revenue: number }[];
  };
  recent_activity: Activity[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  borderColor: "var(--border)",
  borderRadius: "12px",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontWeight: 700,
} as const;

const AXIS_TICK = { fontSize: 11, fill: "var(--text-secondary)" } as const;

function TrendBadge({ trend }: { trend?: Trend }) {
  if (!trend) return null;
  if (trend.current === 0 && trend.previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-zinc-500">
        <Minus className="w-3 h-3" /> No change
      </span>
    );
  }
  const up = trend.change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{trend.change}%
      <span className="font-medium text-slate-400 dark:text-zinc-500">vs prev 30d</span>
    </span>
  );
}

function KpiTile({
  label, value, sub, icon: Icon, gradient, trend, format,
}: {
  label: string; value: number; sub?: string; icon: ComponentType<{ className?: string }>; gradient: string; trend?: Trend; format?: (v: number) => string;
}) {
  const display = format ? format(value) : value.toLocaleString();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/5 transition-colors hover:border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:hover:border-zinc-700"
    >
      <div className={`absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-[0.08]`} />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
            <Icon className="h-5 w-5" />
          </div>
          <TrendBadge trend={trend} />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-800 dark:text-white">{display}</h2>
        {sub && <p className="mt-1 text-xs font-medium text-slate-400 dark:text-zinc-500">{sub}</p>}
      </div>
    </motion.div>
  );
}

export function SalesManagerDashboard({ stats, name }: { stats: SalesManagerStats; name: string }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const metrics = stats.metrics || ({} as SalesManagerStats['metrics']);
  const trends = stats.trends || {};
  const charts = stats.charts;

  const activityData = charts
    ? charts.labels.map((label, i) => ({
        label,
        Calls: charts.calls?.[i] ?? 0,
        Emails: charts.emails?.[i] ?? 0,
      }))
    : [];
  const revenueData = charts?.revenue || [];
  const hasActivity = activityData.some((d) => d.Calls > 0 || d.Emails > 0);
  const hasRevenue = revenueData.some((d) => d.revenue > 0);

  const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-indigo-700 bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 p-8 text-white shadow-2xl"
      >
        <div className="absolute right-0 top-0 p-8 opacity-10">
          <Target className="h-64 w-64 -rotate-12" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold text-indigo-200">
            <TrendingUp className="h-4 w-4" />
            SALES MANAGER DB
          </div>
          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            Ready to close some deals, <span className="bg-gradient-to-r from-blue-200 to-indigo-100 bg-clip-text text-transparent">{name.split(' ')[0]}</span>?
          </h1>
          <p className="max-w-xl text-lg font-medium text-indigo-200 md:text-xl">
            Here&apos;s your pipeline health, activity trends, and revenue momentum — all in one place.
          </p>
        </div>
      </motion.div>

      {/* Primary KPI tiles with trends */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Assigned Leads" value={metrics.assigned_leads || 0} icon={UserPlus} gradient="from-blue-500 to-indigo-600" trend={trends.leads} />
        <KpiTile label="Revenue Won" value={metrics.revenue_won || 0} icon={DollarSign} gradient="from-emerald-500 to-teal-600" trend={trends.revenue} format={inr} />
        <KpiTile label="Deals Won" value={metrics.deals_won || 0} icon={Trophy} gradient="from-violet-500 to-fuchsia-600" trend={trends.deals_won} />
        <KpiTile label="Lead Conversion" value={metrics.conversion_percentage || 0} icon={Percent} gradient="from-amber-500 to-orange-600" sub={`Win rate ${metrics.deal_win_rate || 0}%`} format={(v) => `${v}%`} />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">Outreach Activity</h3>
              <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">Calls and emails over the last 7 days</p>
            </div>
            <PhoneCall className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="h-64 w-full">
            {hasActivity ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "var(--surface)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="Calls" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="Emails" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No calls or emails logged in the last 7 days" />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">Revenue Momentum</h3>
              <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">Won deal value over the last 6 months</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="h-64 w-full">
            {hasRevenue ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="smRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#smRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No won deals recorded in the last 6 months" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Secondary KPI strip */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Assigned Contacts" value={metrics.assigned_contacts || 0} icon={Users} />
        <MiniStat label="Assigned Clients" value={metrics.assigned_clients || 0} icon={Briefcase} />
        <MiniStat label="Calls Logged" value={metrics.calls_logged || 0} icon={PhoneCall} trend={trends.calls} />
        <MiniStat label="Emails Sent" value={metrics.emails_sent || 0} icon={Mail} trend={trends.emails} />
      </motion.div>

      <FollowUpsWidget />
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center dark:border-zinc-700">
      <TrendingUp className="mb-2 h-8 w-8 text-slate-300 dark:text-zinc-600" />
      <p className="max-w-[220px] text-xs font-medium text-slate-400 dark:text-zinc-500">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, trend }: { label: string; value: number; icon: ComponentType<{ className?: string }>; trend?: Trend }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-800 dark:text-white">{value.toLocaleString()}</p>
      {trend && <div className="mt-1"><TrendBadge trend={trend} /></div>}
    </motion.div>
  );
}
