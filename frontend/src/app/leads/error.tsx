"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function LeadsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admissions screen failed to render", error);
  }, [error]);

  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
    <AlertTriangle className="h-8 w-8 text-rose-700" />
    <h1 className="mt-4 text-xl font-semibold">Admissions could not load</h1>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">{error.message || "An unexpected error interrupted this page."}</p>
    {error.digest && <p className="mt-2 text-xs text-[var(--text-secondary)]">Reference: {error.digest}</p>}
    <button type="button" onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Retry</button>
  </main>;
}