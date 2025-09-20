import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({
  requireVerified = false,
}: {
  requireVerified?: boolean;
}) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // Where to send them after auth/verification
  const fromPath =
    (loc.state as any)?.from?.pathname ||
    (loc.pathname === '/verify-email' ? '/make-call' : loc.pathname) ||
    '/make-call';

  if (loading) return null; // or a spinner

  // Not signed in → go to /login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  // Signed in but not verified and route requires verification → go to /verify-email
  if (
    requireVerified &&
    !user.emailVerified &&
    loc.pathname !== '/verify-email'
  ) {
    return (
      <Navigate
        to="/verify-email"
        replace
        state={{ from: { pathname: fromPath } }}
      />
    );
  }

  // If already verified but sitting on /verify-email, bounce to target
  if (user.emailVerified && loc.pathname === '/verify-email') {
    return <Navigate to={fromPath} replace />;
  }

  return <Outlet />;
}
