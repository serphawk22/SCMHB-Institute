"use client";
import { API_BASE_URL } from "@/config";
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Building2, Globe, Mail, Phone, Upload, Download, X, Loader2, ArrowUpRight, Clock, Edit2, Trash2, Tag, GraduationCap, CalendarClock, Video, PhoneCall, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ViewSwitcher, ViewType } from "@/components/ViewSwitcher";
import DemoLimits from "@/components/DemoLimits";
import LeadBatchEnrollmentAction from "@/components/LeadBatchEnrollmentAction";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/context/LanguageContext";
import SalesAssignModal from "@/components/SalesAssignModal";
import LeadScheduleModal, { ScheduleType, SchedulePayload } from "@/components/LeadScheduleModal";

interface Lead {
  id: number;
  company_name: string;
  website?: string | null;
  industry?: string | null;
  course_interest_title?: string | null;
  course_interest_id?: number | null;
  gpa?: number | null;
  education_level?: string | null;
  academic_background?: string | null;
  career_goal?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  status: string;
  is_converted: boolean;
  converted_student_id?: number | null;
  notes?: string | null;
  created_at: string;
  owner_id?: number | null;
  owner_name?: string | null;
  next_followup_at?: string | null;
  next_demo_at?: string | null;
  next_webinar_at?: string | null;
  next_walkin_at?: string | null;
}

interface CourseOption { id: number; title: string; category?: string | null; duration_hours?: number | null; duration_weeks?: number | null; }

const SOURCES = ["Walk-in", "Referral", "WhatsApp", "Instagram", "Facebook", "Website", "Phone Call", "Event", "Other"];

const STAGES = [
  "New",
  "Contacted",
  "Not Responded",
  "Follow-up",
  "Webinar Scheduled",
  "Webinar Attended",
  "Webinar Not Attended",
  "Walk-in Scheduled",
  "Walk-in Attended",
  "Walk-in Not Attended",
  "Converted",
  "Lost",
] as const;
type Stage = typeof STAGES[number];

const STAGE_STYLE: Record<Stage, { chip: string; dot: string; column: string; ring: string }> = {
  New: { chip: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300", dot: "bg-blue-500", column: "from-blue-500/10", ring: "ring-blue-500" },
  Contacted: { chip: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300", dot: "bg-violet-500", column: "from-violet-500/10", ring: "ring-violet-500" },
  "Not Responded": { chip: "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300", dot: "bg-slate-400", column: "from-slate-500/10", ring: "ring-slate-400" },
  "Follow-up": { chip: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300", dot: "bg-amber-500", column: "from-amber-500/10", ring: "ring-amber-500" },
  "Webinar Scheduled": { chip: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300", dot: "bg-indigo-500", column: "from-indigo-500/10", ring: "ring-indigo-500" },
  "Webinar Attended": { chip: "bg-teal-500/10 text-teal-700 border-teal-500/30 dark:text-teal-300", dot: "bg-teal-500", column: "from-teal-500/10", ring: "ring-teal-500" },
  "Webinar Not Attended": { chip: "bg-zinc-500/10 text-zinc-700 border-zinc-500/30 dark:text-zinc-300", dot: "bg-zinc-500", column: "from-zinc-500/10", ring: "ring-zinc-500" },
  "Walk-in Scheduled": { chip: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300", dot: "bg-sky-500", column: "from-sky-500/10", ring: "ring-sky-500" },
  "Walk-in Attended": { chip: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30 dark:text-cyan-300", dot: "bg-cyan-500", column: "from-cyan-500/10", ring: "ring-cyan-500" },
  "Walk-in Not Attended": { chip: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300", dot: "bg-orange-500", column: "from-orange-500/10", ring: "ring-orange-500" },
  Converted: { chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300", dot: "bg-emerald-500", column: "from-emerald-500/10", ring: "ring-emerald-500" },
  Lost: { chip: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-300", dot: "bg-red-500", column: "from-red-500/10", ring: "ring-red-500" },
};

/** Normalises current and legacy statuses to one of the stages. */
function stageOf(lead: Pick<Lead, "status" | "is_converted" | "converted_student_id">): Stage {
  if (lead.converted_student_id || lead.is_converted) return "Converted";
  const s = lead.status || "New";
  if ((STAGES as readonly string[]).includes(s)) return s as Stage;
  const legacy: Record<string, Stage> = {
    Qualified: "Contacted", Interested: "Contacted",
    Demo: "Webinar Scheduled", "Demo Scheduled": "Webinar Scheduled",
    "Demo Completed": "Webinar Attended", "Demo Attended": "Webinar Attended",
    "Demo Missed": "Webinar Not Attended", "Demo Not Attended": "Webinar Not Attended",
    "Proposal Sent": "Follow-up", Negotiation: "Follow-up", "Follow Up": "Follow-up",
    Won: "Converted", Enrolled: "Converted",
    "Walk-in": "Walk-in Scheduled", "Walkin Scheduled": "Walk-in Scheduled",
    "Walkin Attended": "Walk-in Attended", "Walkin Not Attended": "Walk-in Not Attended",
    "Webinar": "Webinar Attended",
  };
  return legacy[s] || "New";
}

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Earliest upcoming scheduled item (follow-up, webinar, or walk-in) for a lead. */
function nextScheduled(lead: Lead): { type: ScheduleType; at: string } | null {
  const items: { type: ScheduleType; at: string }[] = [];
  if (lead.next_followup_at) items.push({ type: "followup", at: lead.next_followup_at });
  if (lead.next_webinar_at) items.push({ type: "webinar", at: lead.next_webinar_at });
  else if (lead.next_demo_at) items.push({ type: "webinar", at: lead.next_demo_at });
  if (lead.next_walkin_at) items.push({ type: "walkin", at: lead.next_walkin_at });
  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return items[0] || null;
}

function ScheduleChip({ lead }: { lead: Lead }) {
  const next = nextScheduled(lead);
  if (!next) return <span className="text-slate-400 text-[12px]">—</span>;
  const overdue = new Date(next.at).getTime() < Date.now();
  const Icon = (next.type === "webinar" || next.type === "demo") ? Video : next.type === "walkin" ? MapPin : PhoneCall;
  const colorClass = overdue
    ? "bg-red-500/10 text-red-600 border-red-500/30"
    : (next.type === "webinar" || next.type === "demo")
    ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300"
    : next.type === "walkin"
    ? "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300"
    : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${colorClass}`}>
      <Icon className="w-3 h-3" /> {fmtWhen(next.at)}
    </span>
  );
}

const emptyForm = {
  company_name: "", website: "", industry: "", course_interest_id: "", gpa: "", education_level: "", academic_background: "", career_goal: "", email: "",
  phone: "", address: "", source: "Website", status: "New", notes: ""
};
import { useRole } from "@/context/RoleContext";

export default function LeadsPage() {
  const { t, language } = useLanguage();
  const { role, user } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== 'Admin' && role !== 'Employee' && role !== 'Intern' && role !== 'SalesManager' && role !== 'Demo') {
      router.replace('/');
    }
  }, [role, router]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [schedule, setSchedule] = useState<{ lead: Lead; type: ScheduleType } | null>(null);
  const [enrollLead, setEnrollLead] = useState<Lead | null>(null);
  const [salesPeople, setSalesPeople] = useState<{ id: number; name: string }[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const isAdmin = role === "Admin" || (role as string) === "SuperAdmin";
  const [sortOption, setSortOption] = useState<"recent" | "name">("recent");
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showSalesAssign, setShowSalesAssign] = useState(false);
  const [pendingLeadForm, setPendingLeadForm] = useState<any>(null);

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${API_BASE_URL}/employees/workload`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Sales team unavailable")))
      .then(d => setSalesPeople((d.employees || d || []).map((e: any) => ({ id: e.id, name: e.name || e.email }))))
      .catch(e => console.warn("Could not load sales team", e));
  }, [isAdmin]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/courses`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Course catalog unavailable")))
      .then(data => setCourses(data.courses || []))
      .catch(error => console.warn("Could not load course catalog for lead intake", error));
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("action") === "add") {
      openCreate();
      window.history.replaceState({}, "", "/leads");
    }
  }, []);

  const fetchLeads = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/leads`);
      if ((role === 'SalesManager' || role === 'Employee') && user?.id) {
        url.searchParams.append('owner_id', String(user.id));
      }
      const res = await fetch(url.toString());
      if (res.ok) setLeads((await res.json()).leads || []);
    } catch (e) {
      console.error("Failed to fetch leads", e);
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let result = leads.filter(l => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || (l.company_name || "").toLowerCase().includes(q)
        || (l.email || "").toLowerCase().includes(q)
        || (l.industry || "").toLowerCase().includes(q)
        || (l.source || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || stageOf(l) === statusFilter;
      return matchSearch && matchStatus;
    });

    if (sortOption === "recent") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortOption === "name") {
      result.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
    }

    return result;
  }, [leads, searchQuery, statusFilter, sortOption]);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>;
    leads.forEach(l => { counts[stageOf(l)] += 1; });
    return counts;
  }, [leads]);

  const apiError = async (res: Response, fallback: string) => {
    const d = await res.json().catch(() => null);
    return typeof d?.detail === "string" ? d.detail : fallback;
  };

  /** Single entry point for moving a lead to a stage (dropdown and drag & drop). */
  const changeStage = async (lead: Lead, target: Stage) => {
    const current = stageOf(lead);
    if (current === target) return;
    if (current === "Converted") {
      alert("This lead is already enrolled as a student, so it stays in Converted.");
      return;
    }
    if (target === "Follow-up") {
      setSchedule({ lead, type: "followup" });
      return;
    }
    if (target === "Webinar Scheduled") {
      setSchedule({ lead, type: "webinar" });
      return;
    }
    if (target === "Walk-in Scheduled") {
      setSchedule({ lead, type: "walkin" });
      return;
    }
    if (target === "Converted") {
      setEnrollLead(lead);
      return;
    }
    const previous = leads;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: target } : l));
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Could not update the stage."));
      fetchLeads(true);
    } catch (e) {
      setLeads(previous);
      alert(e instanceof Error ? e.message : "Could not update the stage.");
    }
  };

  const assignOwner = async (lead: Lead, value: string) => {
    const employeeId = Number(value);
    if (!employeeId) return;
    const person = salesPeople.find(p => p.id === employeeId);
    const previous = leads;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, owner_id: employeeId, owner_name: person?.name || l.owner_name } : l));
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/assign-employee`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Could not assign the sales person."));
    } catch (e) {
      setLeads(previous);
      alert(e instanceof Error ? e.message : "Could not assign the sales person.");
    }
  };

  const submitSchedule = async (p: SchedulePayload) => {
    if (!schedule) return;
    const { lead, type } = schedule;
    const isWebinar = type === "webinar" || type === "demo";
    const isWalkIn = type === "walkin";
    const endpoint = isWebinar ? "webinars" : isWalkIn ? "walk-ins" : "follow-ups";
    const body: any = { scheduled_at: p.scheduled_at, notes: p.notes || null };
    if (isWebinar) body.meeting_url = p.meeting_url || null;
    if (isWalkIn) body.location = p.location || "Campus Front Desk";
    const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await apiError(res, "Could not save the schedule."));
    setSchedule(null);
    await fetchLeads(true);
  };

  const openCreate = () => {
    setEditLead(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLead(lead);
    setForm({
      company_name: lead.company_name,
      website: lead.website || "",
      industry: lead.industry || "",
      course_interest_id: lead.course_interest_id ? String(lead.course_interest_id) : "",
      gpa: lead.gpa === null || lead.gpa === undefined ? "" : String(lead.gpa),
      education_level: lead.education_level || "",
      academic_background: lead.academic_background || "",
      career_goal: lead.career_goal || "",
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      source: lead.source || "Website",
      status: lead.status,
      notes: lead.notes || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      const selectedCourse = courses.find(course => String(course.id) === form.course_interest_id);
      const payload = {
        ...form,
        industry: selectedCourse?.category || form.industry,
        course_interest_id: form.course_interest_id ? Number(form.course_interest_id) : null,
        gpa: form.gpa ? Number(form.gpa) : null,
      };
      if (editLead) {
        // Edit: save directly, no sales assign needed
        await fetch(`${API_BASE_URL}/leads/${editLead.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setShowModal(false);
        fetchLeads();
      } else {
        // New lead: show sales assign modal
        setPendingLeadForm(payload);
        setShowModal(false);
        setShowSalesAssign(true);
      }
    } finally { setSaving(false); }
  };

  const doCreateLead = async (employeeId: number | null, _employeeName: string | null) => {
    setShowSalesAssign(false);
    if (!pendingLeadForm) return;
    try {
      const payload = { ...pendingLeadForm };
      if (employeeId) payload.owner_id = employeeId;
      await fetch(`${API_BASE_URL}/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPendingLeadForm(null);
      fetchLeads();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("leads.confirm_delete"))) return;
    await fetch(`${API_BASE_URL}/leads/${id}`, { method: "DELETE" });
    fetchLeads();
  };

  const handleAddNote = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteText("");
    setNoteLead(lead);
  };

  const handleSaveNote = async () => {
    const content = noteText.trim();
    if (!content || !noteLead) return;
    try {
      setNoteSaving(true);
      const res = await fetch(`${API_BASE_URL}/leads/${noteLead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.error || t("leads.failed_add_note"));
        return;
      }
      setNoteLead(null);
      setNoteText("");
      fetchLeads();
    } catch {
      alert(t("leads.network_error_note"));
    } finally {
      setNoteSaving(false);
    }
  };

  const stats = [
    { label: t("leads.total_leads"), value: leads.length, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: t("leads.new"), value: stageCounts.New, color: "text-violet-600", bg: "bg-violet-500/10" },
    { label: "Important Dates", value: (stageCounts["Follow-up"] || 0) + (stageCounts["Webinar Scheduled"] || 0) + (stageCounts["Walk-in Scheduled"] || 0), color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: t("leads.converted"), value: stageCounts.Converted, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-black">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t("leads.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t("leads.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${API_BASE_URL}/leads/export-csv`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (!res.ok) throw new Error("Export failed");
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'serphawk_leads.csv';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  a.remove();
                } catch (err) {
                  console.error(err);
                  alert("Failed to export leads.");
                }
              }} 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <Link href="/import" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              <Upload className="w-4 h-4" /> {t("leads.import")}
            </Link>
            <button
              id="add-lead-btn"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all hover:shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" /> {t("leads.add_lead")}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {stats.map(s => (
            <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${s.bg} border border-transparent`}>
              <p className={`text-xl font-black ${s.color}`}>{loading ? "—" : s.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Limits Banner */}
      <div className="px-6 pt-4">
        <DemoLimits type="clients" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder={t("leads.search_placeholder")}
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
          
          <select 
            value={sortOption} 
            onChange={e => setSortOption(e.target.value as "recent" | "name")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none border-r-8 border-transparent"
          >
            <option value="recent">{t("leads.sort_recent")}</option>
            <option value="name">{t("leads.sort_name")}</option>
          </select>

          {(["All", ...STAGES] as string[]).map(s => {
            const count = s === "All" ? leads.length : stageCounts[s as Stage];
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? "bg-blue-600 dark:bg-white text-white dark:text-black shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                {s !== "All" && <span className={`w-1.5 h-1.5 rounded-full ${STAGE_STYLE[s as Stage].dot}`} />}
                {s} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* Table */}
      <div className="flex-1 min-w-0 overflow-auto bg-white dark:bg-black">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("leads.no_leads_found")}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{t("leads.try_adjusting")}</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all">
              <Plus className="w-4 h-4" /> {t("leads.add_first_lead")}
            </button>
          </div>
        ) : currentView === 'kanban' ? (
          <div className="flex gap-3 p-4 overflow-x-auto h-full items-stretch">
            {STAGES.map(stage => {
              const colLeads = filtered.filter(l => stageOf(l) === stage);
              const isOver = dragOver === stage;
              const style = STAGE_STYLE[stage];
              return (
                <div key={stage}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== stage) setDragOver(stage); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    const id = Number(e.dataTransfer.getData("text/plain")) || dragId;
                    setDragOver(null); setDragId(null);
                    const lead = leads.find(l => l.id === id);
                    if (lead) changeStage(lead, stage);
                  }}
                  className={`flex-1 min-w-[250px] flex flex-col rounded-2xl border bg-gradient-to-b ${style.column} to-slate-50 dark:to-[#0d0d0d] transition-all ${isOver ? `ring-2 ${style.ring} border-transparent scale-[1.01]` : "border-slate-200 dark:border-[#222222]"}`}>
                  <div className="p-3.5 font-bold text-slate-800 dark:text-white flex items-center justify-between border-b border-slate-200/70 dark:border-[#222222]">
                    <span className="flex items-center gap-2 text-sm"><span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />{stage}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-[#222222] text-xs text-slate-600 dark:text-[#a3a3a3]">{colLeads.length}</span>
                  </div>
                  <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[160px]">
                    {colLeads.map(lead => (
                      <div key={lead.id}
                        draggable={stage !== "Converted"}
                        onDragStart={e => { e.dataTransfer.setData("text/plain", String(lead.id)); e.dataTransfer.effectAllowed = "move"; setDragId(lead.id); }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className={`p-3.5 bg-white dark:bg-black rounded-xl shadow-sm border border-slate-200 dark:border-[#222222] hover:border-blue-500 dark:hover:border-white hover:shadow-md transition-all group ${stage === "Converted" ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${dragId === lead.id ? "opacity-40" : ""}`}>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">{lead.company_name}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5 truncate">{lead.course_interest_title || lead.industry || "No course selected"}</div>
                        <div className="mt-2 space-y-1">
                          {lead.phone && <div className="text-[11px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</div>}
                          {lead.email && <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{lead.email}</span></div>}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <ScheduleChip lead={lead} />
                          <span title={lead.owner_name ? `Sales: ${lead.owner_name}` : "Unassigned"}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium max-w-[110px] truncate ${lead.owner_name ? "text-slate-600 dark:text-slate-300" : "text-slate-400 italic"}`}>
                            <UserRound className="w-3 h-3 shrink-0" /><span className="truncate">{lead.owner_name || "Unassigned"}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {colLeads.length === 0 && <div className={`p-4 text-center text-xs text-slate-400 border-2 border-dashed rounded-xl ${isOver ? "border-blue-400 text-blue-500" : "border-slate-200 dark:border-[#222222]"}`}>{isOver ? "Drop here" : t("leads.no_leads")}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : currentView === 'graph' ? (
          <div className="p-8 h-full">
            <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#222222] h-[500px]">
              <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">{t("leads.leads_by_status")}</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={STAGES.map(s => ({ name: s, count: filtered.filter(l => stageOf(l) === s).length }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#000', borderColor: '#222', color: '#fff'}} />
                  <Bar dataKey="count" fill="currentColor" className="fill-blue-500 dark:fill-white" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : currentView === 'pivot' ? (
          <div className="p-6 h-full overflow-auto">
            <table className="w-full text-left border-collapse bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-2xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#000000] border-b border-slate-200 dark:border-[#222222] text-xs uppercase tracking-wider text-slate-500 dark:text-[#a3a3a3]">
                  <th className="p-4 font-semibold">{t("leads.industry_status2")}</th>
                  {STAGES.map(s => <th key={s} className="p-4 font-semibold text-center">{s}</th>)}
                  <th className="p-4 font-bold text-center border-l border-slate-200 dark:border-[#222222]">{t("leads.total_leads")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#222222]">
                {Array.from(new Set(filtered.map(l => l.industry || 'Other'))).map(ind => {
                  const indLeads = filtered.filter(l => (l.industry || 'Other') === ind);
                  return (
                    <tr key={ind} className="hover:bg-slate-50 dark:hover:bg-[#0a0a0a]">
                      <td className="p-4 font-medium text-slate-900 dark:text-white">{ind}</td>
                      {STAGES.map(s => <td key={s} className="p-4 text-center text-slate-600 dark:text-[#a3a3a3]">{indLeads.filter(l => stageOf(l) === s).length || '-'}</td>)}
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white border-l border-slate-200 dark:border-[#222222]">{indLeads.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[12px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">Course</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Sales person</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Scheduled</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map(lead => {
                  const stage = stageOf(lead);
                  return (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                          {lead.company_name}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        {lead.website && (
                          <div className="flex items-center gap-1 mt-0.5 text-[12px] text-slate-400">
                            <Globe className="w-3 h-3" />
                            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="hover:text-blue-600 hover:underline truncate max-w-[180px]">
                              {lead.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-slate-600 dark:text-slate-300">{lead.course_interest_title || lead.industry || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        {lead.email && <div className="flex items-center gap-1 text-[12px] text-slate-500"><Mail className="w-3 h-3" /><span className="truncate max-w-[160px]">{lead.email}</span></div>}
                        {lead.phone && <div className="flex items-center gap-1 text-[12px] text-slate-500"><Phone className="w-3 h-3" /><span>{lead.phone}</span></div>}
                        {!lead.email && !lead.phone && <span className="text-slate-400 text-[12px]">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {lead.source || "Unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      {isAdmin ? (
                        <select
                          aria-label={`Assign sales person for ${lead.company_name}`}
                          value={lead.owner_id ? String(lead.owner_id) : ""}
                          onChange={e => assignOwner(lead, e.target.value)}
                          className="w-full min-w-[140px] max-w-[190px] px-2.5 py-1.5 rounded-lg text-[13px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                        >
                          <option value="" disabled>Unassigned</option>
                          {lead.owner_id && !salesPeople.some(p => p.id === lead.owner_id) && (
                            <option value={lead.owner_id}>{lead.owner_name || `User #${lead.owner_id}`}</option>
                          )}
                          {salesPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-300"><UserRound className="w-3.5 h-3.5 text-slate-400" />{lead.owner_name || "Unassigned"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        aria-label={`Stage for ${lead.company_name}`}
                        value={stage}
                        onChange={e => changeStage(lead, e.target.value as Stage)}
                        className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${STAGE_STYLE[stage].chip}`}
                      >
                        {STAGES.map(s => <option key={s} value={s} className="text-slate-900 bg-white">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3"><ScheduleChip lead={lead} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.converted_student_id ? (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/students/${lead.converted_student_id}`); }}
                            title="Enrolled student profile"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <GraduationCap className="w-4 h-4" />
                          </button>
                        ) : (
                          <LeadBatchEnrollmentAction
                            leadId={lead.id}
                            leadName={lead.company_name}
                            convertedStudentId={lead.converted_student_id}
                            compact
                            onEnrolled={fetchLeads}
                          />
                        )}
                        <button onClick={e => handleAddNote(lead, e)} title={t("leads.add_note")} className="p-1.5 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-slate-400 hover:text-yellow-600 transition-colors">
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => openEdit(lead, e)} title={t("leads.edit_lead")} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => handleDelete(lead.id, e)} title={t("leads.delete_lead")} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      </div>

      {/* ADD / EDIT MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editLead ? t("leads.edit_lead") : t("leads.add_new_lead")}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("leads.all_incoming_stored")}</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-4">
                {/* Student identity — required */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">
                    {language === "es" ? "Nombre del estudiante" : "Student name"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="e.g. Asha Patel"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.email")}</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.phone")}</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Interested course</label>
                    <select value={form.course_interest_id} onChange={e => {
                      const course = courses.find(item => String(item.id) === e.target.value);
                      setForm(f => ({ ...f, course_interest_id: e.target.value, industry: course?.category || "" }));
                    }}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                      <option value="">Select from course catalog</option>
                      {courses.map(course => <option key={course.id} value={course.id}>{course.title}{course.duration_hours ? ` · ${course.duration_hours}h` : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.source")}</label>
                    <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                      {SOURCES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Education level</label>
                    <select value={form.education_level} onChange={e => setForm(f => ({ ...f, education_level: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white">
                      <option value="">Select education level</option><option>High school</option><option>Diploma</option><option>Bachelor&apos;s</option><option>Master&apos;s</option><option>Doctorate</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">GPA (0-10 scale)</label>
                    <input type="number" min="0" max="10" step="0.1" value={form.gpa} onChange={e => setForm(f => ({ ...f, gpa: e.target.value }))} placeholder="e.g. 8.2" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Academic / work background</label>
                  <textarea value={form.academic_background} onChange={e => setForm(f => ({ ...f, academic_background: e.target.value }))} rows={2} placeholder="Previous study, experience, strengths, and skills to build on" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white resize-y" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">Career goal</label>
                  <textarea value={form.career_goal} onChange={e => setForm(f => ({ ...f, career_goal: e.target.value }))} rows={2} placeholder="What role, industry, or opportunity is the student working toward?" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white resize-y" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.website")}</label>
                    <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  {!editLead && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.status")}</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                        {["New", "Contacted", "Not Responded"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.address")}</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, Country"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("leads.notes")}</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    placeholder={t("leads.notes_placeholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                  {t("leads.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving || !form.company_name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editLead ? t("leads.save_changes") : t("leads.add_lead")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {noteLead && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("leads.add_note")}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{noteLead.company_name}</p>
                </div>
                <button onClick={() => setNoteLead(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder={t("leads.write_note_placeholder")}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Timestamp {new Date().toLocaleString()} {t("leads.timestamp_recorded")}</span>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                <button onClick={() => setNoteLead(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                  {t("leads.cancel")}
                </button>
                <button onClick={handleSaveNote} disabled={noteSaving || !noteText.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                  {noteSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("leads.add_note")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales Assignment Modal */}
      <SalesAssignModal
        isOpen={showSalesAssign}
        onClose={() => { setShowSalesAssign(false); setPendingLeadForm(null); }}
        onAssign={doCreateLead}
        entityType="lead"
      />

      {/* Schedule follow-up / demo (asked when a lead moves to Follow-up or Demo) */}
      <AnimatePresence>
        {schedule && (
          <LeadScheduleModal
            key={`${schedule.lead.id}-${schedule.type}`}
            type={schedule.type}
            leadName={schedule.lead.company_name}
            onClose={() => setSchedule(null)}
            onSubmit={submitSchedule}
          />
        )}
      </AnimatePresence>

      {/* Enrollment modal (opened when a lead moves to Converted) */}
      {enrollLead && (
        <LeadBatchEnrollmentAction
          key={enrollLead.id}
          leadId={enrollLead.id}
          leadName={enrollLead.company_name}
          leadPhone={enrollLead.phone}
          hideTrigger
          externalOpen
          onEnrolled={() => fetchLeads(true)}
          onExternalClose={() => setEnrollLead(null)}
        />
      )}
    </div>
  );
}
