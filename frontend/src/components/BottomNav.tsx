"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  Users,
  FileText,
  BarChart2,
  Grid3x3,
  X,
  LogOut,
  Settings,
  LayoutDashboard,
  UserCheck,
  Bot,
  Phone,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useLanguage } from "@/context/LanguageContext";
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  name: string;
  icon: LucideIcon;
  href: string;
  roles: string[];
}

export function BottomNav() {
  const pathname = usePathname();
  const { role, logout, user } = useRole();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const quickItems: NavItem[] = [
    { key: 'leads', name: t('bottom_nav.leads'), icon: GraduationCap, href: '/leads', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'students', name: t('bottom_nav.students'), icon: Users, href: '/students', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'enrollments', name: t('bottom_nav.enrollments'), icon: FileText, href: '/enrollments', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'analytics', name: t('bottom_nav.analytics'), icon: BarChart2, href: '/reports', roles: ['Admin', 'SalesManager', 'Demo'] },
  ];

  const moreItems: NavItem[] = [
    { key: 'dashboard', name: t('bottom_nav.dashboard'), icon: LayoutDashboard, href: '/', roles: ['Admin', 'Employee', 'Intern'] },
    { key: 'clients', name: t('bottom_nav.clients'), icon: Users, href: '/clients', roles: ['Admin', 'Employee', 'SalesManager'] },
    { key: 'sales_manager', name: t('bottom_nav.sales_manager'), icon: UserCheck, href: '/sales-manager', roles: ['Admin', 'Employee', 'SalesManager'] },
    { key: 'email_agent', name: t('bottom_nav.email_agent'), icon: Bot, href: '/email-agent', roles: ['Admin', 'Employee', 'SalesManager'] },
    { key: 'calls', name: t('bottom_nav.calls'), icon: Phone, href: '/calls', roles: ['Admin', 'Employee', 'SalesManager'] },
    { key: 'messages', name: t('bottom_nav.messages'), icon: MessageCircle, href: '/messages', roles: ['Admin', 'Employee'] },
    { key: 'services_overview', name: t('bottom_nav.services_overview'), icon: Grid3x3, href: '/admin/services-overview', roles: ['Admin', 'Employee'] },
    { key: 'request_board', name: t('bottom_nav.request_board'), icon: FileText, href: '/admin/requests', roles: ['Admin', 'Employee'] },
    { key: 'interns', name: t('bottom_nav.interns'), icon: GraduationCap, href: '/interns', roles: ['Admin', 'Employee'] },
  ];

  const filteredQuickItems = quickItems.filter((item) => item.roles.includes(role));
  if (filteredQuickItems.length === 0) return null;

  const filteredMoreItems = moreItems.filter((item) => item.roles.includes(role));
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href));

  return (
    <>
      {/* Spacer so page content is not hidden behind the bar (mobile only) */}
      <div className="h-20 w-full md:hidden" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-[60] md:hidden">
        {/* Slide-up "more" sheet */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="absolute bottom-full mb-2 left-3 right-3 rounded-3xl border border-slate-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('bottom_nav.more_options')}</p>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    {filteredMoreItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={cn(
                            "p-3 rounded-2xl flex flex-col items-center gap-2 text-center transition-all",
                            isActive(item.href)
                              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                              : "bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[11px] font-bold leading-tight">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-3 border-t border-slate-200 dark:border-zinc-800 pt-3">
                    <div className="flex items-center gap-3 px-2 pb-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-black">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-zinc-100">{user?.name || 'User'}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">{role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setIsMenuOpen(false); logout(); }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> {t('bottom_nav.logout')}
                    </button>
                    <button className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                      <Settings className="w-4 h-4" /> {t('bottom_nav.settings')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* The bar */}
        <div
          className="border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <nav className="flex items-stretch justify-around px-1">
            {filteredQuickItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-w-0"
                >
                  <span className={cn(
                    "flex items-center justify-center w-10 h-8 rounded-full transition-colors",
                    active ? "bg-indigo-100 dark:bg-indigo-500/20" : ""
                  )}>
                    <Icon className={cn("w-5 h-5", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-400")} />
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold truncate max-w-full px-1",
                    active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400"
                  )}>
                    {item.name}
                  </span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-w-0"
            >
              <span className={cn(
                "flex items-center justify-center w-10 h-8 rounded-full transition-colors",
                isMenuOpen ? "bg-indigo-100 dark:bg-indigo-500/20" : ""
              )}>
                <Grid3x3 className={cn("w-5 h-5", isMenuOpen ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-400")} />
              </span>
              <span className="text-[10px] font-bold truncate max-w-full px-1 text-slate-500 dark:text-zinc-400">
                {t('bottom_nav.more')}
              </span>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
