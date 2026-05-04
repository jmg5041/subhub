/**
 * Home page — redirects to dashboard if logged in, login page if not.
 * 
 * This is the "/" route. The middleware handles most auth redirects,
 * but this page provides a clean fallback.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/auth/login');
  }
}