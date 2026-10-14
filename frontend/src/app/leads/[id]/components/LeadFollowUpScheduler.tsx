"use client";

import { Bell, CalendarClock } from "lucide-react";
import { useRole } from "@/context/RoleContext";

/**
 * Overview card for scheduling a follow-up. Follow-ups now live in the lead's Follow-ups tab
 * (reminders when due, AI suggestions from notes, an optional automatic email), so this card
 * opens that tab instead of writing a note and a work-queue task.
 */
export default function LeadFollowUpScheduler({ onOpen }: { onOpen: () => void }) {
  const { role } = useRole();
  const canSchedule = ["Admin", "Employee", "SalesManager", "Sales", "Demo"].includes(role);

  if (!canSchedule) return null;

  return <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
    <div className="flex flex-wrap items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Bell className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Schedule a follow-up</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Plan the next call or email in the Follow-ups tab: you get a reminder when it is due, AI suggestions from your notes, and an optional automatic email.</p>
      </div>
      <button type="button" onClick={onOpen} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800">
        <CalendarClock className="h-4 w-4" />Open Follow-ups
      </button>
    </div>
  </section>;
}
