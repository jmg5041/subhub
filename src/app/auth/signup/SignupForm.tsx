'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';

function AppLogo({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <Image src={logoUrl} alt={appName} width={160} height={48} className="mx-auto object-contain" />
  }
  return <span className="text-3xl font-bold text-gray-900">{appName}</span>
}

export default function SignupForm({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { firstName, lastName, orgName, selfSignup: true },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSubmitted(true);
    }
  };

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <AppLogo appName={appName} logoUrl={logoUrl} />
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-8 text-center space-y-5">
            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">Check your inbox</h2>
              <p className="text-sm text-gray-500 mt-2">
                We sent a confirmation link to
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{email}</p>
              <p className="text-sm text-gray-500 mt-1">
                Click the link to activate your free trial.
              </p>
            </div>

            {/* What happens next */}
            <div className="text-left bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What happens next</p>
              {[
                { n: '1', text: 'Confirm your email — link expires in 24 hours' },
                { n: '2', text: 'Set up your school info, campuses, and billing' },
                { n: '3', text: 'Import your teachers and substitutes' },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    {step.n}
                  </span>
                  <p className="text-sm text-gray-600">{step.text}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400">
              Didn&apos;t get it? Check your spam folder or{' '}
              <a href="mailto:info@substitutes.us" className="text-blue-600 hover:underline">
                contact support
              </a>.
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Wrong email?{' '}
            <button onClick={() => setSubmitted(false)} className="text-blue-600 hover:underline">
              Go back
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <AppLogo appName={appName} logoUrl={logoUrl} />
          <p className="mt-2 text-sm text-gray-500">Start your 6-month free trial</p>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-8 space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
                <input id="firstName" type="text" required value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
                <input id="lastName" type="text" required value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">School or district name</label>
              <input id="orgName" type="text" required placeholder="e.g. Lincoln Unified School District"
                value={orgName} onChange={(e) => setOrgName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Work email</label>
              <input id="email" type="email" required placeholder="you@school.edu"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input id="password" type="password" required placeholder="Min. 8 characters"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">Confirm password</label>
              <input id="confirm" type="password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors">
              {loading ? 'Creating account…' : 'Start free trial →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  );
}
