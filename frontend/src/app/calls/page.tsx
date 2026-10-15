"use client";

import { motion } from "framer-motion";
import { Phone, Sparkles, Clock } from "lucide-react";

export default function CallsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
          <Phone className="w-10 h-10 text-white" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-4">
          <Clock className="w-3.5 h-3.5" />
          Coming Soon
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
          Calling Agent
        </h1>

        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
          Our AI-powered calling agent is currently being set up and will be live soon.
          Stay tuned for automated outreach, call scheduling, and intelligent follow-ups — all from right here.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span>Powered by AI · Launching soon</span>
        </div>
      </motion.div>
    </div>
  );
}
