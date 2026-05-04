/**
 * Dashboard page — the main landing page after login.
 * 
 * Shows a summary of today's absences:
 * - Quick stat cards (total absences, unfilled, filled, no sub needed)
 * - Quick action buttons (Create Absence, Approve, Reconcile)
 * - Unfilled absences table (shows which periods still need a sub)
 * - Date picker (defaults to today)
 * 
 * This is the "command center" — principals see at a glance what needs attention today.
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user profile to personalize the dashboard
  const { data: profile } = await supabase
    .from('users')
    .select('*, schools(*)')
    .eq('id', user?.id ?? '')
    .single();

  const firstName = profile?.first_name || 'User';
  const schoolName = profile?.schools?.name || 'Your School';

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning, {firstName}
        </h1>
        <p className="text-gray-500">{schoolName}</p>
      </div>

      {/* Stat cards — show today's absence summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Absences"
          value="0"
          subtitle="today"
          color="blue"
        />
        <StatCard
          title="Unfilled"
          value="0"
          subtitle="need a sub"
          color="red"
        />
        <StatCard
          title="Filled"
          value="0"
          subtitle="sub assigned"
          color="green"
        />
        <StatCard
          title="No Sub Needed"
          value="0"
          subtitle="admin only"
          color="gray"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/absences/create"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
        >
          <CalendarPlus className="h-8 w-8 text-blue-600" />
          <div>
            <p className="font-semibold text-gray-900">Create Absence</p>
            <p className="text-sm text-gray-500">Report a teacher absence</p>
          </div>
        </Link>

        <Link
          href="/absences/approve"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50"
        >
          <ClipboardCheck className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-semibold text-gray-900">Approve Absences</p>
            <p className="text-sm text-gray-500">Review pending requests</p>
          </div>
        </Link>

        <Link
          href="/absences/reconcile"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-purple-300 hover:bg-purple-50"
        >
          <ClipboardList className="h-8 w-8 text-purple-600" />
          <div>
            <p className="font-semibold text-gray-900">Reconcile</p>
            <p className="text-sm text-gray-500">Confirm sub assignments</p>
          </div>
        </Link>
      </div>

      {/* Unfilled absences table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Unfilled Absences</h2>
          <p className="text-sm text-gray-500">Teachers without an assigned substitute</p>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No absences yet. Create one to get started!</p>
          <Link
            href="/absences/create"
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create Absence
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * StatCard — a simple card showing a number and label.
 * Used for the dashboard summary cards.
 */
function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'red' | 'green' | 'gray';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorMap[color]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{subtitle}</p>
    </div>
  );
}