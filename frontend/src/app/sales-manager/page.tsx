"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import { useLanguage } from "@/context/LanguageContext";
import { 
  ArrowRight, Bell, FileText, MessageCircle, UserCheck, 
  Search, Briefcase, Mail, Clock, ShieldAlert, FileSignature
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SalesClient {
  id: number;
  companyName?: string | null;
  name?: string | null;
  projectName?: string | null;
  websiteUrl?: string | null;
  status?: string | null;
  lastActivityDate?: string | null;
}

interface SalesLead {
  id: number;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  is_converted?: boolean;
  course_interest_title?: string | null;
  created_at?: string | null;
}

interface SalesStudent {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  active_course?: string | null;
  enrollment_count: number;
}

function formatClientStatus(status: string) {
  switch (status) {
    case "Active":
    case "Accepted":
      return "Active";
    case "Pending":
      return "Pending";
    case "Onboarding":
      return "Onboarding";
    case "Lost":
      return "Lost";
    default:
      return status || "Unknown";
  }
}

export default function SalesManagerPage() {
  const { role, user } = useRole();
  const { t } = useLanguage();
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [students, setStudents] = useState<SalesStudent[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"note" | "activity" | "ticket">("note");
  
  const [remarkBody, setRemarkBody] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const canAccess = role === "Admin" || role === "Employee" || role === "SalesManager" || role === "Demo";

  const fetchAssignedClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients?assigned_employee_id=${user?.id}&per_page=50`);
      const data = await res.json();
      setClients(data.clients || []);
      if (data.clients?.length) setSelectedClientId((current) => current || data.clients[0].id);
    } catch (error) {
      console.error("Unable to load assigned clients:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchAssignedLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads?owner_id=${user?.id}`);
      if (!res.ok) throw new Error("Unable to load assigned leads.");
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error("Unable to load assigned leads:", error);
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, [user?.id]);

  const fetchAssignedStudents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/students`);
      if (!response.ok) throw new Error("Unable to load assigned students.");
      const data = await response.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error("Unable to load assigned students:", error);
      setStudents([]);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchAssignedClients();
    fetchAssignedLeads();
    fetchAssignedStudents();
  }, [user?.id, fetchAssignedClients, fetchAssignedLeads, fetchAssignedStudents]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      client.companyName?.toLowerCase().includes(term) ||
      client.projectName?.toLowerCase().includes(term) ||
      client.websiteUrl?.toLowerCase().includes(term)
    );
  });

  const convertedLeads = leads.filter((lead) => lead.is_converted || ["Enrolled", "Won", "Converted"].includes(lead.status || ""));
  const openLeads = leads.filter((lead) => !convertedLeads.includes(lead) && lead.status !== "Lost");
  const demoLeads = openLeads.filter((lead) => lead.status === "Demo Scheduled");

  const handleRemarkSubmit = async () => {
    if (!selectedClient || !remarkBody.trim() || !user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[Sales Manager] ${remarkBody.trim()}`, authorId: user.id, isInternal: true }),
      });
      if (res.ok) {
        setRemarkBody("");
        showToast(t("common.save") + "!");
      } else {
        showToast("Error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error");
    }
  };

  const handleActivitySubmit = async () => {
    if (!selectedClient || !activityBody.trim() || !user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorId: user.id,
          action: "Sales outreach",
          method: "Sales Hub",
          content: activityBody.trim(),
          details: "Logged from Sales Manager workspace",
        }),
      });
      if (res.ok) {
        setActivityBody("");
        showToast(t("common.save") + "!");
      } else {
        showToast("Error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error");
    }
  };

  const handleTicketSubmit = async () => {
    if (!selectedClient || !ticketBody.trim() || !user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[Admin Ticket] ${ticketBody.trim()}\n\nPlease escalate this issue to the admin team with the full sales context.`,
          authorId: user.id,
          isInternal: true,
        }),
      });
      if (res.ok) {
        setTicketBody("");
        showToast(t("common.save") + "!");
      } else {
        showToast("Error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error");
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-6 py-20 text-center transition-colors">
        <div className="max-w-xl rounded-3xl border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-white dark:bg-zinc-900/5 p-10 text-slate-800 dark:text-zinc-100 dark:text-white shadow-xl">
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between px-6 pt-6">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            <UserCheck className="w-4 h-4" /> {t("sales_manager.workspace")}
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-zinc-50 dark:text-white tracking-tight">{t("sales_manager.title")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-zinc-400 dark:text-slate-400 max-w-2xl font-medium">
              {t("sales_manager.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 w-full lg:w-auto">
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-white dark:bg-zinc-900/5 p-5 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Briefcase size={18} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400">{t("sales_manager.assigned")}</p>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-zinc-50 dark:text-white">{clients.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-white dark:bg-zinc-900/5 p-5 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <ShieldAlert size={18} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400">{t("sales_manager.active")}</p>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-zinc-50 dark:text-white">{clients.filter((c) => ["Active", "Accepted", "In Progress"].includes(c.status || "")).length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-white dark:bg-zinc-900/5 p-5 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                <Clock size={18} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 dark:text-slate-400">{t("sales_manager.inactive")}</p>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-zinc-50 dark:text-white">{clients.filter((c) => !c.lastActivityDate).length}</p>
          </div>
        </div>
      </div>

      <section className="space-y-4 px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-zinc-50">My lead pipeline</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Move prospects from first contact through demos and enrollment.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
              View all leads <ArrowRight size={15} />
            </Link>
            <Link href="/leads?action=add" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700">
              Add lead
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Assigned leads", value: leads.length, accent: "text-slate-900 dark:text-white" },
            { label: "Open opportunities", value: openLeads.length, accent: "text-amber-700 dark:text-amber-300" },
            { label: "Demos scheduled", value: demoLeads.length, accent: "text-sky-700 dark:text-sky-300" },
            { label: "Enrolled", value: convertedLeads.length, accent: "text-emerald-700 dark:text-emerald-300" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">{metric.label}</p>
              <p className={`mt-2 text-2xl font-black ${metric.accent}`}>{leadsLoading ? "—" : metric.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-700">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50">Recent prospects</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Your latest assigned leads and course interests.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{openLeads.length} active</span>
          </div>
          {leadsLoading ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">Loading your pipeline…</p>
          ) : openLeads.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">No open leads assigned yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">New prospects assigned to you will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {openLeads.slice(0, 5).map((lead) => {
                const leadName = lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "New lead";
                return (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="flex flex-col gap-2 px-5 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/60">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">{leadName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{lead.course_interest_title || lead.email || lead.phone || "Course interest not recorded"}</p>
                    </div>
                    <span className="inline-flex w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">{lead.status || "New"}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 px-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900 dark:text-zinc-50">My assigned students</h2><p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Student profiles, enrollment status, and course handoffs assigned to you.</p></div><Link href="/students" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">All my students <ArrowRight size={15} /></Link></div>
        {students.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{students.slice(0, 6).map(student => <Link key={student.id} href={`/students/${student.id}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-700"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-zinc-50">{student.name}</p><p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">{student.active_course || student.email || student.phone || "Course not assigned"}</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{student.status}</span></div><p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">{student.enrollment_count} enrollments</p></Link>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 px-5 py-6 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">No students are assigned to you yet. Students converted from your leads will appear here.</div>}
      </section>

      <div className="px-6 grid gap-6 xl:grid-cols-[400px_1fr]">
        
        <section className="flex flex-col space-y-4 rounded-[2rem] border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-slate-900/50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-zinc-50 dark:text-white">{t("sales_manager.assigned_accounts")}</h2>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400">{t("sales_manager.select_account_prompt")}</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400 dark:text-slate-400">
              {filteredClients.length} visible
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("sales_manager.search_placeholder")}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-10 py-3 text-sm text-slate-800 dark:text-zinc-100 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-600 dark:border-slate-700 p-8 text-center text-sm font-semibold text-slate-400">
                {t("sales_manager.loading_accounts")}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-600 dark:border-slate-700 p-8 text-center text-sm font-semibold text-slate-400">
                {t("sales_manager.no_accounts")}
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedClientId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={cn(
                      "w-full text-left rounded-2xl border p-4 transition-all duration-200",
                      isSelected 
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-md shadow-indigo-500/5 scale-[1.02]" 
                        : "border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2",
                          client.status === "Active" || client.status === "Accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                          client.status === "Pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                          "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {formatClientStatus(client.status || "")}
                        </span>
                        <h3 className={cn(
                          "text-base font-black truncate", 
                          isSelected ? "text-indigo-900 dark:text-indigo-100" : "text-slate-900 dark:text-zinc-50 dark:text-white"
                        )}>
                          {client.companyName || client.name || "Client account"}
                        </h3>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="flex flex-col space-y-6">
          {!selectedClient ? (
            <div className="h-full flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 dark:border-zinc-600 dark:border-slate-700 bg-white dark:bg-zinc-900/50 dark:bg-slate-900/30 p-12 text-center">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
                <Briefcase size={32} className="text-indigo-300 dark:text-indigo-700" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 dark:text-white mb-2">{t("sales_manager.select_account")}</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400 max-w-md">
                {t("sales_manager.select_account_desc")}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-[2rem] border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-zinc-400 mb-1">{t("sales_manager.operating_on")}</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-zinc-50 dark:text-white mb-2">{selectedClient.companyName || selectedClient.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/admin/clients/${selectedClient.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-bold shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5">
                      {t("sales_manager.open_profile")} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex-1 rounded-[2rem] border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
                <div className="flex border-b border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-slate-50 dark:bg-slate-950 overflow-x-auto custom-scrollbar">
                  <button 
                    onClick={() => setActiveTab("note")} 
                    className={cn(
                      "flex-1 whitespace-nowrap px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                      activeTab === "note" ? "bg-white dark:bg-zinc-900 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "text-slate-500 dark:text-zinc-400 dark:text-slate-400 hover:text-slate-700 dark:text-zinc-200 dark:hover:text-slate-200"
                    )}
                  >
                    <FileSignature size={16} /> {t("sales_manager.client_note")}
                  </button>
                  <button 
                    onClick={() => setActiveTab("activity")} 
                    className={cn(
                      "flex-1 whitespace-nowrap px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                      activeTab === "activity" ? "bg-white dark:bg-zinc-900 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "text-slate-500 dark:text-zinc-400 dark:text-slate-400 hover:text-slate-700 dark:text-zinc-200 dark:hover:text-slate-200"
                    )}
                  >
                    <Clock size={16} /> {t("sales_manager.log_activity")}
                  </button>
                  <button 
                    onClick={() => setActiveTab("ticket")} 
                    className={cn(
                      "flex-1 whitespace-nowrap px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                      activeTab === "ticket" ? "bg-white dark:bg-zinc-900 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "text-slate-500 dark:text-zinc-400 dark:text-slate-400 hover:text-slate-700 dark:text-zinc-200 dark:hover:text-slate-200"
                    )}
                  >
                    <ShieldAlert size={16} /> {t("sales_manager.admin_ticket")}
                  </button>
                </div>

                <div className="p-6 md:p-8 flex-1">
                  <AnimatePresence mode="wait">
                    {activeTab === "note" && (
                      <motion.div
                        key="note"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50 dark:text-white mb-2">{t("sales_manager.log_outreach_note")}</h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-6">{t("sales_manager.log_outreach_desc")}</p>
                        
                        <textarea
                          value={remarkBody}
                          onChange={(e) => setRemarkBody(e.target.value)}
                          rows={6}
                          className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-zinc-100 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                          placeholder={t("sales_manager.note_placeholder")}
                        />
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleRemarkSubmit}
                            disabled={!remarkBody.trim()}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("sales_manager.save_note")}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "activity" && (
                      <motion.div
                        key="activity"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50 dark:text-white mb-2">{t("sales_manager.record_activity")}</h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-6">{t("sales_manager.record_activity_desc")}</p>
                        
                        <textarea
                          value={activityBody}
                          onChange={(e) => setActivityBody(e.target.value)}
                          rows={6}
                          className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-zinc-100 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                          placeholder={t("sales_manager.activity_placeholder")}
                        />
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleActivitySubmit}
                            disabled={!activityBody.trim()}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("sales_manager.log_activity")}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "ticket" && (
                      <motion.div
                        key="ticket"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50 dark:text-white mb-2">{t("sales_manager.escalate_admin")}</h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400 mb-6">{t("sales_manager.escalate_desc")}</p>
                        
                        <textarea
                          value={ticketBody}
                          onChange={(e) => setTicketBody(e.target.value)}
                          rows={6}
                          className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-zinc-100 dark:text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
                          placeholder={t("sales_manager.ticket_placeholder")}
                        />
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleTicketSubmit}
                            disabled={!ticketBody.trim()}
                            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("sales_manager.send_ticket")}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="px-6">
        <section className="rounded-[2rem] border border-slate-200 dark:border-zinc-700 dark:border-white/10 bg-white dark:bg-zinc-900 dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-zinc-50 dark:text-white">{t("sales_manager.quick_tools")}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-zinc-400 dark:text-slate-400">{t("sales_manager.quick_tools_desc")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/work-queue" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 transition hover:bg-slate-50 dark:hover:bg-zinc-800">
                <Clock size={16} /> My work queue
              </Link>
              <Link href="/enrollments" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 transition hover:bg-slate-50 dark:hover:bg-zinc-800">
                <FileText size={16} /> My enrollments & slips
              </Link>
              <Link href="/email-agent" className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 px-5 py-2.5 text-sm font-bold text-indigo-700 dark:text-indigo-300 transition-colors">
                <Mail size={16} /> {t("sales_manager.draft_outreach")}
              </Link>
              <Link href="/invoices" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-white dark:bg-zinc-900 dark:bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                <FileText size={16} /> {t("sales_manager.issue_invoice")}
              </Link>
              <Link href="/admin/requests" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700 bg-white dark:bg-zinc-900 dark:bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                <MessageCircle size={16} /> {t("sales_manager.admin_tickets")}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
          >
            <div className="rounded-2xl bg-slate-900 dark:bg-white dark:bg-zinc-900 px-6 py-3.5 text-sm font-bold text-white dark:text-slate-900 dark:text-zinc-50 shadow-2xl flex items-center gap-2">
              <Bell size={16} />
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
