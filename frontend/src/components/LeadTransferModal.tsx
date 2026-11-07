"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowRightLeft, Loader2, X } from "lucide-react";
import { API_BASE_URL } from "@/config";

export interface TransferLead {
  id: number;
  company_name: string;
  status?: string | null;
  is_converted?: boolean;
  converted_student_id?: number | null;
  owner_id?: number | null;
}

interface SalesPerson {
  id: number;
  name: string;
}

interface LeadTransferModalProps {
  leads: TransferLead[];
  salesPeople: SalesPerson[];
  isAdmin: boolean;
  userId?: number;
  getAuthHeaders: () => Record<string, string>;
  onTransferred: () => void | Promise<void>;
  compact?: boolean;
}

export default function LeadTransferModal({
  leads,
  salesPeople,
  isAdmin,
  userId,
  getAuthHeaders,
  onTransferred,
  compact = false,
}: LeadTransferModalProps) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(isAdmin ? "" : userId ? String(userId) : "");
  const [destinationId, setDestinationId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [stageFilter, setStageFilter] = useState("All stages");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sourceLeads = useMemo(
    () => leads.filter(lead => String(lead.owner_id ?? "") === sourceId),
    [leads, sourceId],
  );
  const stages = useMemo(
    () => ["All stages", ...Array.from(new Set(sourceLeads.map(lead =>
      lead.is_converted || lead.converted_student_id ? "Converted" : lead.status || "New",
    )))],
    [sourceLeads],
  );
  const visibleLeads = sourceLeads.filter(lead =>
    stageFilter === "All stages"
    || (lead.is_converted || lead.converted_student_id ? "Converted" : lead.status || "New") === stageFilter,
  );
  const eligibleDestinations = salesPeople.filter(person => String(person.id) !== sourceId);

  const close = () => {
    setOpen(false);
    setError("");
    setSelectedIds([]);
    setStageFilter("All stages");
    setDestinationId("");
    setReason("");
  };

  const transfer = async () => {
    if (!sourceId || !destinationId || !selectedIds.length || !reason.trim()) {
      setError("Choose source and destination, select leads, and enter a reason.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/leads/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          lead_ids: selectedIds,
          source_employee_id: Number(sourceId),
          employee_id: Number(destinationId),
          reason: reason.trim(),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : "Could not transfer the selected leads.";
        throw new Error(detail);
      }
      close();
      setReason("");
      setDestinationId("");
      await onTransferred();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "Could not transfer the selected leads.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSourceId(isAdmin ? "" : userId ? String(userId) : "");
          setDestinationId("");
          setReason("");
          setSelectedIds([]);
          setOpen(true);
        }}
        className={compact
          ? "inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          : "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"}
      >
        <ArrowRightLeft className="h-4 w-4" /> Transfer leads
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="lead-transfer-title" className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <header className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-zinc-800">
              <div>
                <h2 id="lead-transfer-title" className="text-lg font-bold text-slate-900 dark:text-white">Transfer leads</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a source, destination, lead stages, and provide a reason.</p>
              </div>
              <button type="button" onClick={close} aria-label="Close transfer dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </header>

            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Source salesperson
                  <select
                    aria-label="Source salesperson"
                    value={sourceId}
                    disabled={!isAdmin}
                    onChange={event => {
                      setSourceId(event.target.value);
                      setSelectedIds([]);
                      setStageFilter("All stages");
                      setDestinationId("");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Choose source salesperson</option>
                    {salesPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Destination salesperson
                  <select
                    aria-label="Destination salesperson"
                    value={destinationId}
                    onChange={event => setDestinationId(event.target.value)}
                    disabled={!sourceId}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Choose destination salesperson</option>
                    {eligibleDestinations.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
              </div>

              {sourceId && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Choose a lead stage</p>
                  <div className="flex flex-wrap gap-2">
                    {stages.map(stage => {
                      const count = stage === "All stages" ? sourceLeads.length : sourceLeads.filter(lead =>
                        (lead.is_converted || lead.converted_student_id ? "Converted" : lead.status || "New") === stage,
                      ).length;
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setStageFilter(stage)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${stageFilter === stage ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-slate-300"}`}
                        >
                          {stage} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sourceId && (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="sticky top-0 flex items-center justify-between bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-zinc-900 dark:text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={visibleLeads.length > 0 && visibleLeads.every(lead => selectedIds.includes(lead.id))}
                        onChange={event => setSelectedIds(current => event.target.checked
                          ? Array.from(new Set([...current, ...visibleLeads.map(lead => lead.id)]))
                          : current.filter(id => !visibleLeads.some(lead => lead.id === id)))}
                      />
                      Select all in stage
                    </label>
                    <span>{selectedIds.length} selected</span>
                  </div>
                  {visibleLeads.map(lead => (
                    <label key={lead.id} className="flex cursor-pointer items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-sm dark:border-zinc-800">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={event => setSelectedIds(current => event.target.checked
                          ? [...current, lead.id]
                          : current.filter(id => id !== lead.id))}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{lead.company_name}</span>
                      <span className="text-xs text-slate-500">{lead.is_converted || lead.converted_student_id ? "Converted" : lead.status || "New"}</span>
                    </label>
                  ))}
                  {visibleLeads.length === 0 && <p className="p-5 text-center text-sm text-slate-500">No leads in this stage for the selected source.</p>}
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Transfer reason <span className="text-red-600">*</span>
                <textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={1000} required placeholder="Explain why these leads are being transferred" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>

              {error && <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-zinc-800">
              <button type="button" onClick={close} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700">Cancel</button>
              <button type="button" onClick={() => void transfer()} disabled={saving || !sourceId || !destinationId || !selectedIds.length || !reason.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {saving ? "Transferring…" : `Transfer ${selectedIds.length || ""} leads`}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
