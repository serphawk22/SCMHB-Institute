"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, LogOut, User, ChevronDown, Menu, X,
  Bell,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/context/NotificationContext";
import { useLanguage } from "@/context/LanguageContext";
import { defaultSidebarSections, iconMap } from "@/components/Sidebar";

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  Admin: { label: "Admin", color: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  Employee: { label: "Employee", color: "bg-sky-100 text-sky-700 border border-sky-200" },
  Client: { label: "Client", color: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  Intern: { label: "Intern", color: "bg-amber-100 text-amber-700 border border-amber-200" },
  SalesManager: { label: "Sales Manager", color: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" },
};

// Options already provided as quick actions in the mobile bottom nav — hidden here.
const QUICK_HREFS = ["/leads", "/students", "/enrollments", "/reports"];

export default function TopRightControls() {
  const { role, email, logout, user } = useRole();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close the mobile nav drawer whenever the route changes
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const badge = ROLE_BADGE[role as string];

  const isExternalHref = (href: string) => /^https?:\/\//i.test(href);
  const itemKey = (id: string) => String(id).replace("item-", "").replace(/-/g, "_");
  const itemLabel = (item: any) => {
    const k = `sidebar.${itemKey(item.id)}`;
    const v = t(k);
    return v === k ? item.name : v;
  };
  const sectionLabel = (section: any) => {
    if (!section.heading) return null;
    const k = `sidebar.section_${String(section.id).replace("section-", "").replace(/-/g, "_")}`;
    const v = t(k);
    return v === k ? section.heading : v;
  };

  const navSections = defaultSidebarSections
    .map((section: any) => ({
      ...section,
      items: (section.items || []).filter(
        (item: any) =>
          (role === "SuperAdmin" || item.roles?.includes(role)) &&
          !QUICK_HREFS.includes(item.href)
      ),
    }))
    .filter((section: any) => section.items.length > 0);

  return (
    <>
      <div className="fixed top-6 right-6 z-[70] flex items-center gap-2">
        {/* Mobile navigation menu (hidden on desktop) */}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation menu"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl shadow-sm border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Profile Menu */}
        <div className="relative" ref={userRef}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-xl transition-all shadow-sm border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[12px] shadow-sm">
              {email ? email[0].toUpperCase() : "U"}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl overflow-hidden z-[60] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
              >
                <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-inner">
                    {email ? email[0].toUpperCase() : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate text-slate-800 dark:text-zinc-100">{email || "User"}</p>
                    <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${badge?.color}`}>
                      {badge?.label}
                    </span>
                  </div>
                </div>
                
                <div className="py-2">
                  <Link href="/profile" onClick={() => setUserMenuOpen(false)}>
                    <div className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                      <User className="w-4 h-4" /> Profile
                    </div>
                  </Link>
                  <Link href="/admin/settings" onClick={() => setUserMenuOpen(false)}>
                    <div className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                      <Settings className="w-4 h-4" /> Settings
                    </div>
                  </Link>
                  <Link href="/notifications" onClick={() => setUserMenuOpen(false)}>
                    <div className="flex items-center justify-between gap-3 w-full px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4" /> Notifications
                      </div>
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
                
                <div className="py-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-[13px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-100/50 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {navOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOpen(false)}
              className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-[90] w-[85%] max-w-sm bg-white dark:bg-zinc-900 md:hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                <img
                  src="https://scmhub.com/img/scm-hub-logo-c.png"
                  alt="SCM Hub"
                  className="h-8 w-auto object-contain"
                />
                <button
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {navSections.map((section: any) => {
                  const heading = sectionLabel(section);
                  return (
                    <div key={section.id}>
                      {heading && (
                        <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          {heading}
                        </p>
                      )}
                      <div className="space-y-1">
                        {section.items.map((item: any) => {
                          const Icon = iconMap[item.icon] || Menu;
                          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                          const cls = cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                            active
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                              : "text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                          );
                          const content = (
                            <>
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{itemLabel(item)}</span>
                            </>
                          );
                          return isExternalHref(item.href) ? (
                            <a key={item.id} href={item.href} className={cls}>{content}</a>
                          ) : (
                            <Link key={item.id} href={item.href} onClick={() => setNavOpen(false)} className={cls}>
                              {content}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>

              <div className="shrink-0 border-t border-slate-200 dark:border-zinc-800 p-3 space-y-1">
                <div className="flex items-center gap-3 px-2 pb-2">
                  <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-black">
                    {user?.name?.charAt(0).toUpperCase() || email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-zinc-100">{user?.name || email || 'User'}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{role}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setNavOpen(false); logout(); }}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> {t('bottom_nav.logout')}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
