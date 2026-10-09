"use client";

import { useState, useEffect } from "react";
import { Trophy, Star, Ticket, DollarSign, IndianRupee, GraduationCap, Users, Video, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/config";

interface LeaderboardEntry {
  user_id: number;
  name: string;
  role: string;
  deals_closed: number;
  revenue_closed: number;
  meetings_booked: number;
  calls_made: number;
  leads_managed?: number;
  clients_managed?: number;
  tickets_assigned?: number;
  tickets_in_production?: number;
  tickets_completed?: number;
  leads_assigned?: number;
  students_converted?: number;
  demos_held?: number;
  demos_scheduled?: number;
  total_business?: number;
  advance_collected?: number;
  amount_due?: number;
}

type RankingMetric = "total_business" | "advance_collected" | "amount_due" | "students_converted" | "leads_assigned" | "demos_held";

const rankingMetrics: Array<{ key: RankingMetric; label: string }> = [
  { key: "total_business", label: "Total business" },
  { key: "advance_collected", label: "Advance collected" },
  { key: "students_converted", label: "Students converted" },
  { key: "leads_assigned", label: "Leads" },
  { key: "demos_held", label: "Demos held" },
  { key: "amount_due", label: "Amount due" },
];

const formatINR = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(value || 0);

function rankingValue(entry: LeaderboardEntry, metric: RankingMetric) {
  return Number(entry[metric] || 0);
}

function formatRankingValue(entry: LeaderboardEntry, metric: RankingMetric) {
  const value = rankingValue(entry, metric);
  return metric === "total_business" || metric === "advance_collected" || metric === "amount_due"
    ? formatINR(value)
    : value.toLocaleString("en-IN");
}

function SalesPodium({ top3, metric }: { top3: LeaderboardEntry[]; metric: RankingMetric }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[260px]">
        {top3[1] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-2 md:order-1">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shadow-lg border-4 border-slate-300 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-slate-600 dark:text-zinc-300">2</span>
            </div>
            <div className="w-full h-40 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-800/50 rounded-t-xl border border-b-0 border-slate-200 dark:border-zinc-700 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-44">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[1].name}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-2">{formatRankingValue(top3[1], metric)}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[1].students_converted || 0} students converted</span>
            </div>
          </div>
        )}
        {top3[0] && (
          <div className="flex flex-col items-center group w-full md:w-56 order-1 md:order-2 relative">
            <div className="absolute top-10 pointer-events-none">
              <Star className="w-6 h-6 text-yellow-400 absolute -left-10 -top-5 animate-pulse" />
              <Star className="w-4 h-4 text-orange-400 absolute left-12 -top-10 animate-bounce" />
            </div>
            <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shadow-xl border-4 border-yellow-400 relative z-10 mb-[-25px] transition-transform group-hover:scale-110">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="w-full h-52 bg-gradient-to-t from-yellow-200 via-yellow-100 to-yellow-50 dark:from-yellow-900/40 dark:via-yellow-900/20 dark:to-transparent rounded-t-xl border border-b-0 border-yellow-300 dark:border-yellow-700/50 flex flex-col items-center pt-10 px-4 transition-all group-hover:h-56 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
              <span className="font-black text-lg text-yellow-900 dark:text-yellow-500 truncate w-full text-center">{top3[0].name}</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-2">{formatRankingValue(top3[0], metric)}</span>
              <span className="text-xs text-yellow-700 dark:text-yellow-600 uppercase tracking-wider mt-1 font-bold">{top3[0].demos_held || 0} demos held</span>
            </div>
          </div>
        )}
        {top3[2] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-3">
            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shadow-lg border-4 border-orange-400 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-orange-600 dark:text-orange-500">3</span>
            </div>
            <div className="w-full h-32 bg-gradient-to-t from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-orange-200 dark:border-orange-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-36">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[2].name}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-2">{formatRankingValue(top3[2], metric)}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[2].leads_assigned || 0} leads</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsPodium({ top3 }: { top3: LeaderboardEntry[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[260px]">
        {top3[1] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-2 md:order-1">
            <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center shadow-lg border-4 border-cyan-300 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">2</span>
            </div>
            <div className="w-full h-40 bg-gradient-to-t from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-cyan-200 dark:border-cyan-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-44">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[1].name}</span>
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[1].tickets_assigned ?? 0} tickets</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[1].tickets_in_production ?? 0} in prod</span>
            </div>
          </div>
        )}
        {top3[0] && (
          <div className="flex flex-col items-center group w-full md:w-56 order-1 md:order-2 relative">
            <div className="absolute top-10 pointer-events-none">
              <Star className="w-6 h-6 text-cyan-400 absolute -left-10 -top-5 animate-pulse" />
              <Star className="w-4 h-4 text-blue-400 absolute left-12 -top-10 animate-bounce" />
            </div>
            <div className="w-20 h-20 rounded-full bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center shadow-xl border-4 border-cyan-400 relative z-10 mb-[-25px] transition-transform group-hover:scale-110">
              <Ticket className="w-8 h-8 text-cyan-500" />
            </div>
            <div className="w-full h-52 bg-gradient-to-t from-cyan-200 via-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:via-cyan-900/20 dark:to-transparent rounded-t-xl border border-b-0 border-cyan-300 dark:border-cyan-700/50 flex flex-col items-center pt-10 px-4 transition-all group-hover:h-56 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <span className="font-black text-lg text-cyan-900 dark:text-cyan-400 truncate w-full text-center">{top3[0].name}</span>
              <span className="text-base font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[0].tickets_assigned ?? 0} tickets</span>
              <span className="text-xs text-cyan-700 dark:text-cyan-600 uppercase tracking-wider mt-1 font-bold">{top3[0].tickets_in_production ?? 0} in production</span>
            </div>
          </div>
        )}
        {top3[2] && (
          <div className="flex flex-col items-center group w-full md:w-48 order-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shadow-lg border-4 border-blue-400 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <div className="w-full h-32 bg-gradient-to-t from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-blue-200 dark:border-blue-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-36">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full text-center">{top3[2].name}</span>
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 mt-2">{top3[2].tickets_assigned ?? 0} tickets</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{top3[2].tickets_in_production ?? 0} in prod</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [salesLeaderboard, setSalesLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ticketsLeaderboard, setTicketsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rankMetric, setRankMetric] = useState<RankingMetric>("total_business");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const [salesResponse, ticketsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/leaderboard?kind=institute`),
          fetch(`${API_BASE_URL}/leaderboard?kind=tickets`),
        ]);
        if (salesResponse.ok) setSalesLeaderboard(await salesResponse.json());
        if (ticketsResponse.ok) setTicketsLeaderboard(await ticketsResponse.json());
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const salesBoard = [...salesLeaderboard].sort((a, b) => {
    const difference = rankMetric === "amount_due"
      ? rankingValue(a, rankMetric) - rankingValue(b, rankMetric)
      : rankingValue(b, rankMetric) - rankingValue(a, rankMetric);
    return difference || rankingValue(b, "total_business") - rankingValue(a, "total_business");
  });
  const salesTop3 = salesBoard.slice(0, 3);
  const instituteTotals = salesLeaderboard.reduce((totals, entry) => ({
    leads: totals.leads + (entry.leads_assigned || 0),
    conversions: totals.conversions + (entry.students_converted || 0),
    demos: totals.demos + (entry.demos_held || 0),
    business: totals.business + (entry.total_business || 0),
    advance: totals.advance + (entry.advance_collected || 0),
    due: totals.due + (entry.amount_due || 0),
  }), { leads: 0, conversions: 0, demos: 0, business: 0, advance: 0, due: 0 });
  const ticketsBoard = [...ticketsLeaderboard].sort((a, b) => (b.tickets_assigned ?? 0) - (a.tickets_assigned ?? 0));
  const ticketsTop3 = ticketsBoard.slice(0, 3);

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-12 min-h-[calc(100vh-64px)]">

      {/* ── SALES LEADERBOARD ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg"><IndianRupee className="w-5 h-5 text-emerald-700" /></div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Institute Sales Leaderboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Leads, conversions, demos, and enrollment finances</p>
          </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rank employees by">
            {rankingMetrics.map(metric => (
              <button key={metric.key} type="button" aria-pressed={rankMetric === metric.key} onClick={() => setRankMetric(metric.key)} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition-colors", rankMetric === metric.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300")}>
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Leads assigned", value: instituteTotals.leads.toLocaleString("en-IN"), icon: Users, color: "text-sky-700 dark:text-sky-300" },
            { label: "Students converted", value: instituteTotals.conversions.toLocaleString("en-IN"), icon: GraduationCap, color: "text-blue-700 dark:text-blue-300" },
            { label: "Demos held", value: instituteTotals.demos.toLocaleString("en-IN"), icon: Video, color: "text-teal-700 dark:text-teal-300" },
            { label: "Total business", value: formatINR(instituteTotals.business), icon: IndianRupee, color: "text-emerald-700 dark:text-emerald-300" },
            { label: "Advance collected", value: formatINR(instituteTotals.advance), icon: Wallet, color: "text-amber-700 dark:text-amber-300" },
            { label: "Amount due", value: formatINR(instituteTotals.due), icon: DollarSign, color: "text-rose-700 dark:text-rose-300" },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{stat.label}</span>
                <stat.icon className={cn("h-4 w-4 shrink-0", stat.color)} />
              </div>
              <p className="mt-2 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white sm:text-lg">{stat.value}</p>
            </div>
          ))}
        </div>

        {salesTop3.length > 0 && <SalesPodium top3={salesTop3} metric={rankMetric} />}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Salesperson</th>
                  <th className="px-4 py-4 text-center font-medium">Leads</th>
                  <th className="px-4 py-4 text-center font-medium">Converted</th>
                  <th className="px-4 py-4 text-center font-medium">Demos held</th>
                  <th className="px-4 py-4 text-right font-medium">Total business</th>
                  <th className="px-4 py-4 text-right font-medium">Advance</th>
                  <th className="px-4 py-4 text-right font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {salesBoard.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">No salesperson activity yet.</td></tr>
                )}
                {salesBoard.map((entry, index) => (
                  <tr key={entry.user_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-slate-100 text-slate-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-32">
                          <p>{entry.name}</p>
                          <p className="text-xs font-normal text-slate-500 dark:text-zinc-400">{entry.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-medium">{entry.leads_assigned || 0}</td>
                    <td className="px-4 py-4 text-center font-semibold text-blue-700 dark:text-blue-300">{entry.students_converted || 0}</td>
                    <td className="px-4 py-4 text-center font-medium">{entry.demos_held || 0}<span className="ml-1 text-xs text-slate-400">(+{entry.demos_scheduled || 0})</span></td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-700 dark:text-emerald-300">{formatINR(entry.total_business || 0)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-700 dark:text-amber-300">{formatINR(entry.advance_collected || 0)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-rose-700 dark:text-rose-300">{formatINR(entry.amount_due || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── TICKETS LEADERBOARD ─────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-xl"><Ticket className="w-5 h-5 text-cyan-600" /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              Tickets Leaderboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Ranked by employee tickets assigned &amp; in production</p>
          </div>
        </div>
        {ticketsTop3.length > 0 && ticketsTop3.some(e => (e.tickets_assigned ?? 0) > 0) && (
          <TicketsPodium top3={ticketsTop3} />
        )}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium text-center">Tickets Assigned</th>
                  <th className="px-6 py-4 font-medium text-center">In Production</th>
                  <th className="px-6 py-4 font-medium text-center">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {ticketsBoard.map((entry, index) => (
                  <tr key={entry.user_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-cyan-100 text-cyan-700" :
                        index === 1 ? "bg-slate-100 text-slate-700" :
                        index === 2 ? "bg-blue-100 text-blue-700" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        {entry.name}
                        <span className="text-[10px] text-slate-400 font-medium">{entry.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 font-bold">{entry.tickets_assigned || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold">{entry.tickets_in_production || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600">{entry.tickets_completed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}

