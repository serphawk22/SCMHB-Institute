"use client";
import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/config";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Users, BookOpen, Layers, GraduationCap, DollarSign, Star, Target, Loader2, BarChart2, UserCog } from "lucide-react";

const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#6366f1"];

export default function InstituteAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/institute/analytics`)
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Could not load analytics.");
        setData(payload);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-10 h-10 animate-spin text-violet-400" /></div>;
  if (!data) return <div className="text-center text-zinc-500 py-20">Failed to load analytics</div>;

  const kpis = [
    { label:"Total Revenue", value:`₹${(data.revenue?.total_collected||0).toLocaleString()}`, icon:DollarSign, color:"from-green-500 to-emerald-600", sub:`₹${(data.revenue?.total_due||0).toLocaleString()} pending` },
    { label:"Total Students", value:data.students?.total||0, icon:GraduationCap, color:"from-violet-500 to-indigo-600", sub:`${data.students?.active||0} active` },
    { label:"Active Courses", value:data.courses?.active||0, icon:BookOpen, color:"from-amber-500 to-orange-600", sub:`${data.courses?.total||0} total courses` },
    { label:"Active Batches", value:data.batches?.active||0, icon:Layers, color:"from-blue-500 to-cyan-600", sub:`${data.batches?.total||0} total batches` },
    { label:"Lead Conversion", value:`${data.leads?.conversion_rate||0}%`, icon:Target, color:"from-pink-500 to-rose-600", sub:`${data.leads?.converted||0} / ${data.leads?.total||0} leads` },
    { label:"Total Enrollments", value:data.enrollments?.total||0, icon:TrendingUp, color:"from-teal-500 to-cyan-600", sub:`${data.enrollments?.active||0} active` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><BarChart2 className="w-5 h-5 text-white" /></div>
          Institute Analytics
        </h1>
        <p className="text-slate-500 dark:text-zinc-400 mt-1">Comprehensive overview of institute performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k,i)=>(
          <motion.div key={k.label} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${k.color} opacity-10 rounded-bl-3xl`} />
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-400 text-sm">{k.label}</p>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center`}><k.icon className="w-4 h-4 text-white" /></div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{k.value}</p>
            <p className="text-xs text-zinc-500">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-slate-900 dark:text-white font-semibold text-lg mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-violet-500" />Monthly Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.monthly_revenue||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke="#71717a" tick={{fontSize:11}} />
              <YAxis stroke="#71717a" tick={{fontSize:11}} tickFormatter={v=>`₹${v.toLocaleString()}`} />
              <Tooltip contentStyle={{background:"#18181b",border:"1px solid #27272a",borderRadius:"12px",color:"#fff"}} formatter={(v:any)=>[`₹${v.toLocaleString()}`,""]} />
              <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2.5} dot={{fill:"#8b5cf6",strokeWidth:2}} />
              <Line type="monotone" dataKey="enrollments" stroke="#06b6d4" strokeWidth={2} dot={{fill:"#06b6d4"}} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Revenue by Course */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.35}} className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-slate-900 dark:text-white font-semibold text-lg mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-amber-500" />Revenue by Course</h2>
          {(data.revenue_by_course||[]).length === 0 ? (
            <div className="flex items-center justify-center h-56 text-zinc-500"><p>No data yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.revenue_by_course||[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" stroke="#71717a" tick={{fontSize:11}} tickFormatter={v=>`₹${v.toLocaleString()}`} />
                <YAxis type="category" dataKey="course" width={120} stroke="#71717a" tick={{fontSize:11}} />
                <Tooltip contentStyle={{background:"#18181b",border:"1px solid #27272a",borderRadius:"12px",color:"#fff"}} formatter={(v:any)=>[`₹${v.toLocaleString()}`,""]} />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructor Performance */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-slate-900 dark:text-white font-semibold text-lg mb-4 flex items-center gap-2"><UserCog className="w-5 h-5 text-amber-500" />Instructor Performance</h2>
          <div className="space-y-3">
            {(data.instructor_stats||[]).length===0 ? <p className="text-zinc-500 text-center py-8">No instructors yet</p> :
            (data.instructor_stats||[]).map((ins: any, i: number)=>(
              <div key={ins.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">{ins.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-medium text-sm truncate">{ins.name}</p>
                  <p className="text-zinc-500 text-xs">{ins.batches} batches · {ins.students} students</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="text-amber-400 font-semibold text-sm">{ins.avg_rating||"—"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sales Performance */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.45}} className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-slate-900 dark:text-white font-semibold text-lg mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-green-500" />Sales Team Performance</h2>
          <div className="space-y-3">
            {(data.sales_stats||[]).length===0 ? <p className="text-zinc-500 text-center py-8">No sales data yet</p> :
            (data.sales_stats||[]).map((s: any, i: number)=>(
              <div key={s.user_id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">{(s.name||"?")[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-medium text-sm truncate">{s.name||"Unknown"}</p>
                  <p className="text-zinc-500 text-xs">{s.leads_assigned} leads · {s.leads_converted} converted</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold text-sm">{s.conversion_rate}%</p>
                  <p className="text-zinc-600 text-xs">conversion</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
