/**
 * App sidebar — the main navigation component.
 * 
 * This sidebar appears on every authenticated page. It shows:
 * - SubHub logo/name
 * - Navigation links grouped by function
 * - Current user info at the bottom
 * 
 * It uses shadcn/ui sidebar pattern and collapses on mobile.
 * Each link uses a Lucide icon for visual scanning.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarPlus,
  UserSearch,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  Settings,
  LogOut,
  School,
  Users,
  Building2,
  HelpCircle,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Navigation items — grouped by function
const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Absences',
    items: [
      { href: '/absences/create', label: 'Create Absence', icon: CalendarPlus },
      { href: '/absences/approve', label: 'Approve Absences', icon: ClipboardCheck },
      { href: '/absences/reconcile', label: 'Reconcile', icon: ClipboardList },
    ],
  },
  {
    label: 'Substitutes',
    items: [
      { href: '/absences/find-sub', label: 'Find Substitute', icon: UserSearch },
      { href: '/admin/subs', label: 'Hire Subs', icon: Users },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/reports', label: 'All Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/admin/users', label: 'Manage Users', icon: Users },
      { href: '/admin/schools', label: 'Schools', icon: Building2 },
    ],
  },
];

export function AppSidebar({
  isOpen = false,
  onClose,
  role,
}: {
  isOpen?: boolean
  onClose?: () => void
  role?: string | null
}) {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <aside className={cn(
      'flex h-[100dvh] w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white',
      // Desktop: always visible in the flow
      'md:relative md:translate-x-0',
      // Mobile: fixed overlay, slides in/out
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out md:transition-none',
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      {/* Logo area */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <School className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">SubHub</h1>
            <p className="text-[10px] leading-tight text-gray-500">Admin Portal</p>
          </div>
        </Link>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.filter(group =>
          group.label !== 'Admin' || ['admin', 'principal'].includes(role ?? '')
        ).map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-gray-200 p-4 space-y-1">
        <Link
          href="/help"
          onClick={onClose}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}