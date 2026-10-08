"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";

export default function LeadFollowUpScheduler({ leadId, leadName }: { leadId: string | string[]; leadName: string }) {
  const { role } = useRole();
  const [dueDate, setDueDate] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canSchedule = ["Admin", "Employee", "SalesManager", "Sales", "Demo"].includes(role);

  if (!canSchedule) return null;

  const scheduleFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dueDate || !content.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          task_title: `Follow up: ${leadName}`,
          task_description: content.trim(),
          due_date: new Date(dueDate).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not schedule this follow-up.");
      setMessage(`Reminder scheduled for ${new Date(dueDate).toLocaleString()}.`);
      setDueDate("");
      setContent("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not schedule this follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Bell className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Schedule a follow-up</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Log what the lead asked for and add a reminder to your work queue.</p>
      </div>
    </div>
    <form onSubmit={scheduleFollowUp} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Reminder date and time<input required type="datetime-local" value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm" /></label>
      <label className="text-sm font-medium sm:col-span-2">Conversation outcome / next step<textarea required rows={3} value={content} onChange={event => setContent(event.target.value)} placeholder="What did they ask for? What should happen next?" className="mt-1.5 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" /></label>
      {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300 sm:col-span-2">{message} <Link href="/work-queue" className="inline-flex items-center gap-1 font-semibold underline"><CalendarClock className="h-3.5 w-3.5" />Open work queue</Link></p>}
      <div className="flex justify-end sm:col-span-2"><button type="submit" disabled={saving || !dueDate || !content.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}{saving ? "Scheduling…" : "Schedule reminder"}</button></div>
    </form>
  </section>;
}