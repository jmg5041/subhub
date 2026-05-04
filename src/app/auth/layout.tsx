/**
 * Auth layout — shared wrapper for login/signup pages.
 * 
 * Auth pages (login, signup, callback) don't get the sidebar layout.
 * They get a clean, centered layout instead.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}