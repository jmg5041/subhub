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
      { href: '/substitutes/find', label: 'Find Substitute', icon: UserSearch },
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
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo area */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <School className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">SubHub</h1>
          <p className="text-[10px] leading-tight text-gray-500">Substitute Management</p>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
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
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}