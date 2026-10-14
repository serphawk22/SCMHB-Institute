"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trophy, Star, DollarSign, IndianRupee, GraduationCap, Users, Video, 
  Wallet, UserCog, Award, BookOpen, Layers, CheckCircle2, Sparkles, ExternalLink 
} from "lucide-react";
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
  leads_assigned?: number;
  students_converted?: number;
  demos_held?: number;
  demos_scheduled?: number;
  total_business?: number;
  advance_collected?: number;
  amount_due?: number;
}

interface InstructorLeaderboardEntry {
  id: number;
  instructor_id: number;
  name: string;
  email?: string;
  expertise?: string;
  qualification?: string;
  experience_years?: number;
  is_active: boolean;
  avg_rating: number;
  students_taught: number;
  batches_total: number;
  batches_active: number;
  batches_upcoming: number;
  batches_completed: number;
  feedback_count: number;
}

type RankingMetric = "total_business" | "advance_collected" | "amount_due" | "students_converted" | "leads_assigned" | "demos_held";
type InstructorMetric = "avg_rating" | "students_taught" | "batches_active" | "batches_total";

const rankingMetrics: Array<{ key: RankingMetric; label: string }> = [
  { key: "total_business", label: "Total business" },
  { key: "advance_collected", label: "Advance collected" },
  { key: "students_converted", label: "Students converted" },
  { key: "leads_assigned", label: "Leads" },
  { key: "demos_held", label: "Demos held" },
  { key: "amount_due", label: "Amount due" },
];

const instructorMetrics: Array<{ key: InstructorMetric; label: string }> = [
  { key: "avg_rating", label: "Highest Rated" },
  { key: "students_taught", label: "Most Students" },
  { key: "batches_active", label: "Active Batches" },
  { key: "batches_total", label: "Total Batches" },
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

function InstructorPodium({ top3 }: { top3: InstructorLeaderboardEntry[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[260px]">
        {/* Rank 2 */}
        {top3[1] && (
          <div className="flex flex-col items-center group w-full md:w-52 order-2 md:order-1">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shadow-lg border-4 border-slate-300 dark:border-zinc-600 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-slate-600 dark:text-zinc-300">2</span>
            </div>
            <div className="w-full h-44 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-800/60 rounded-t-xl border border-b-0 border-slate-200 dark:border-zinc-700 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-48 text-center">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full">{top3[1].name}</span>
              <div className="flex items-center gap-1 mt-2 text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-black">{top3[1].avg_rating > 0 ? top3[1].avg_rating.toFixed(1) : "—"}</span>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">{top3[1].students_taught} students</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">{top3[1].batches_active} active batches</span>
            </div>
          </div>
        )}

        {/* Rank 1 */}
        {top3[0] && (
          <div className="flex flex-col items-center group w-full md:w-60 order-1 md:order-2 relative">
            <div className="absolute top-10 pointer-events-none">
              <Sparkles className="w-6 h-6 text-amber-400 absolute -left-10 -top-5 animate-pulse" />
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 absolute left-14 -top-8 animate-bounce" />
            </div>
            <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shadow-xl border-4 border-amber-400 relative z-10 mb-[-25px] transition-transform group-hover:scale-110">
              <Award className="w-9 h-9 text-amber-500" />
            </div>
            <div className="w-full h-56 bg-gradient-to-t from-amber-200 via-amber-100 to-amber-50 dark:from-amber-900/40 dark:via-amber-900/20 dark:to-transparent rounded-t-xl border border-b-0 border-amber-300 dark:border-amber-700/50 flex flex-col items-center pt-10 px-4 transition-all group-hover:h-60 shadow-[0_0_30px_rgba(245,158,11,0.2)] text-center">
              <span className="font-black text-lg text-amber-950 dark:text-amber-300 truncate w-full">{top3[0].name}</span>
              <div className="flex items-center gap-1.5 mt-2 text-amber-500 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 rounded-full shadow-xs">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-base font-black text-slate-900 dark:text-white">{top3[0].avg_rating > 0 ? top3[0].avg_rating.toFixed(1) : "—"}</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">({top3[0].feedback_count} reviews)</span>
              </div>
              <span className="text-xs text-indigo-700 dark:text-indigo-400 font-bold mt-2">{top3[0].students_taught} students taught</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-400 uppercase tracking-wider mt-0.5 font-bold">{top3[0].batches_active} active batches</span>
            </div>
          </div>
        )}

        {/* Rank 3 */}
        {top3[2] && (
          <div className="flex flex-col items-center group w-full md:w-52 order-3">
            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center shadow-lg border-4 border-orange-400 relative z-10 mb-[-20px] transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">3</span>
            </div>
            <div className="w-full h-36 bg-gradient-to-t from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-transparent rounded-t-xl border border-b-0 border-orange-200 dark:border-orange-800/50 flex flex-col items-center pt-8 px-4 transition-all group-hover:h-40 text-center">
              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate w-full">{top3[2].name}</span>
              <div className="flex items-center gap-1 mt-2 text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-black">{top3[2].avg_rating > 0 ? top3[2].avg_rating.toFixed(1) : "—"}</span>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">{top3[2].students_taught} students</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">{top3[2].batches_active} active batches</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [salesLeaderboard, setSalesLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [instructorLeaderboard, setInstructorLeaderboard] = useState<InstructorLeaderboardEntry[]>([]);
  const [rankMetric, setRankMetric] = useState<RankingMetric>("total_business");
  const [instructorMetric, setInstructorMetric] = useState<InstructorMetric>("avg_rating");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const [salesResponse, instructorsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/leaderboard?kind=institute`),
          fetch(`${API_BASE_URL}/leaderboard?kind=instructors`),
        ]);
        if (salesResponse.ok) setSalesLeaderboard(await salesResponse.json());
        if (instructorsResponse.ok) setInstructorLeaderboard(await instructorsResponse.json());
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

  // Sales Board sorting
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

  // Instructor Board sorting
  const instructorsBoard = [...instructorLeaderboard].sort((a, b) => {
    if (instructorMetric === "avg_rating") {
      const diff = (b.avg_rating || 0) - (a.avg_rating || 0);
      return diff !== 0 ? diff : (b.students_taught || 0) - (a.students_taught || 0);
    }
    if (instructorMetric === "students_taught") {
      const diff = (b.students_taught || 0) - (a.students_taught || 0);
      return diff !== 0 ? diff : (b.avg_rating || 0) - (a.avg_rating || 0);
    }
    if (instructorMetric === "batches_active") {
      const diff = (b.batches_active || 0) - (a.batches_active || 0);
      return diff !== 0 ? diff : (b.avg_rating || 0) - (a.avg_rating || 0);
    }
    return (b.batches_total || 0) - (a.batches_total || 0);
  });
  const instructorTop3 = instructorsBoard.slice(0, 3);

  const instructorTotals = instructorLeaderboard.reduce((acc, inst) => ({
    instructors: acc.instructors + 1,
    students: acc.students + (inst.students_taught || 0),
    activeBatches: acc.activeBatches + (inst.batches_active || 0),
    totalBatches: acc.totalBatches + (inst.batches_total || 0),
    ratingsSum: acc.ratingsSum + (inst.avg_rating || 0),
    ratingsCount: inst.avg_rating > 0 ? acc.ratingsCount + 1 : acc.ratingsCount,
  }), { instructors: 0, students: 0, activeBatches: 0, totalBatches: 0, ratingsSum: 0, ratingsCount: 0 });

  const overallAvgRating = instructorTotals.ratingsCount > 0 
    ? (instructorTotals.ratingsSum / instructorTotals.ratingsCount).toFixed(1)
    : "—";

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-12 min-h-[calc(100vh-64px)]">

      {/* ── SALES LEADERBOARD ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl">
              <IndianRupee className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Institute Sales Leaderboard
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Leads, conversions, demos, and enrollment finances</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rank employees by">
            {rankingMetrics.map(metric => (
              <button 
                key={metric.key} 
                type="button" 
                aria-pressed={rankMetric === metric.key} 
                onClick={() => setRankMetric(metric.key)} 
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer", 
                  rankMetric === metric.key 
                    ? "border-blue-600 bg-blue-600 text-white shadow-xs" 
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
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
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{stat.label}</span>
                <stat.icon className={cn("h-4 w-4 shrink-0", stat.color)} />
              </div>
              <p className="mt-2 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white sm:text-lg">{stat.value}</p>
            </div>
          ))}
        </div>

        {salesTop3.length > 0 && <SalesPodium top3={salesTop3} metric={rankMetric} />}
        
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
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
                        index === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        index === 1 ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300" :
                        index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
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

      {/* ── INSTRUCTORS LEADERBOARD ──────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 rounded-xl">
              <UserCog className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Instructor Leaderboard
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Ranked by learner feedback, students taught, and active teaching batches</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rank instructors by">
            {instructorMetrics.map(metric => (
              <button 
                key={metric.key} 
                type="button" 
                aria-pressed={instructorMetric === metric.key} 
                onClick={() => setInstructorMetric(metric.key)} 
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer", 
                  instructorMetric === metric.key 
                    ? "border-amber-600 bg-amber-600 text-white shadow-xs" 
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Instructors</span>
              <UserCog className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{instructorTotals.instructors}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Students Taught</span>
              <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{instructorTotals.students.toLocaleString("en-IN")}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Active Batches</span>
              <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{instructorTotals.activeBatches}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Average Rating</span>
              <Star className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
            </div>
            <p className="mt-2 text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span>{overallAvgRating}</span>
              <span className="text-xs font-normal text-slate-400">★</span>
            </p>
          </div>
        </div>

        {instructorTop3.length > 0 && <InstructorPodium top3={instructorTop3} />}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Instructor</th>
                  <th className="px-4 py-4 font-medium">Domain &amp; Qualification</th>
                  <th className="px-4 py-4 text-center font-medium">Students</th>
                  <th className="px-4 py-4 text-center font-medium">Active Batches</th>
                  <th className="px-4 py-4 text-center font-medium">Completed</th>
                  <th className="px-4 py-4 text-center font-medium">Rating</th>
                  <th className="px-4 py-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {instructorsBoard.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">
                      No instructors registered yet.
                    </td>
                  </tr>
                )}
                {instructorsBoard.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                        index === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        index === 1 ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300" :
                        index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm shadow-xs">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-36">
                          <p className="font-bold text-slate-900 dark:text-white">{entry.name}</p>
                          <p className="text-xs font-normal text-slate-500 dark:text-zinc-400 truncate max-w-xs">{entry.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {entry.expertise ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {entry.expertise}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {entry.qualification && (
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">{entry.qualification}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs">
                        {entry.students_taught}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold text-xs">
                        {entry.batches_active}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600 dark:text-zinc-400 font-medium text-xs">
                      {entry.batches_completed}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{entry.avg_rating > 0 ? entry.avg_rating.toFixed(1) : "—"}</span>
                        {entry.feedback_count > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">({entry.feedback_count})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link 
                        href={`/instructors/${entry.id}`} 
                        className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold transition"
                      >
                        Profile <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
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
