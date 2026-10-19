"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  Users,
  FileText,
  BarChart2,
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
  const { role } = useRole();
  const { t } = useLanguage();

  const quickItems: NavItem[] = [
    { key: 'leads', name: t('bottom_nav.leads'), icon: GraduationCap, href: '/leads', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'students', name: t('bottom_nav.students'), icon: Users, href: '/students', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'enrollments', name: t('bottom_nav.enrollments'), icon: FileText, href: '/enrollments', roles: ['Admin', 'Employee', 'SalesManager', 'Demo'] },
    { key: 'analytics', name: t('bottom_nav.analytics'), icon: BarChart2, href: '/reports', roles: ['Admin', 'SalesManager', 'Demo'] },
  ];

  const filteredQuickItems = quickItems.filter((item) => item.roles.includes(role));
  if (filteredQuickItems.length === 0) return null;

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href));

  return (
    <>
      {/* Spacer so page content is not hidden behind the bar (mobile only) */}
      <div className="h-20 w-full md:hidden" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-[60] md:hidden">
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
          </nav>
        </div>
      </div>
    </>
  );
}
