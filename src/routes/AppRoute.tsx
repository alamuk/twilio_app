import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequireAuth from '../components/RequireAuth';

import HeaderBar from '../components/HeaderBar';
import WebCallPage from '../pages/WebCallPage';
import ServerCallPage from '../pages/ServerCallPage';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import ResetPassword from '../pages/auth/ResetPassword';
import VerifyEmail from '../pages/auth/VerifyEmail';

export default function AppShell() {
  const { user } = useAuth();
  const showTabs = !!user && user.emailVerified; // show tabs only after verified login

  return (
    <div className="page">
      <HeaderBar />

      {showTabs && (
        <nav className="tabs">
          <NavLink
            to="/web-call"
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            Hello Web Call
          </NavLink>
          <NavLink
            to="/make-call"
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            Make a Call
          </NavLink>
        </nav>
      )}

      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset" element={<ResetPassword />} />

        {/* Signed-in (not necessarily verified) */}
        <Route element={<RequireAuth requireVerified={false} />}>
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>

        {/* Private (verified email) */}
        <Route element={<RequireAuth requireVerified />}>
          {/* keep root at /web-call once authenticated */}
          <Route path="/" element={<Navigate to="/web-call" replace />} />
          <Route path="/web-call" element={<WebCallPage />} />
          <Route path="/make-call" element={<ServerCallPage />} />
        </Route>

        {/* Fallbacks */}
        <Route
          path="*"
          element={<Navigate to={user ? '/web-call' : '/login'} replace />}
        />
      </Routes>

      <footer className="footer"></footer>
    </div>
  );
}
