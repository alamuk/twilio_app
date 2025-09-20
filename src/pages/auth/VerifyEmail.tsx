import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../../auth/firebase';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function VerifyEmail() {
  const { user, resendVerification, logout } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation() as any;
  const to = loc.state?.from?.pathname || '/make-call';

  // Auto-check every 3s
  useEffect(() => {
    let t = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(t);
          nav(to, { replace: true });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [nav, to]);

  // Manual button
  const proceedIfVerified = async () => {
    try {
      setBusy(true);
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        nav(to, { replace: true });
      } else {
        setErr('Still not verified yet—check your inbox, then try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      setBusy(true);
      setErr(null);
      await resendVerification();
      setMsg('Verification email sent.');
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Verify your email</h1>
        <p>
          We sent a verification link to <strong>{user?.email}</strong>. This
          page will continue automatically after you verify, or use the button
          below.
        </p>
        {msg && <div className="auth-ok">{msg}</div>}
        {err && <div className="auth-error">{err}</div>}
        <div className="auth-actions">
          <button className="auth-btn" onClick={resend} disabled={busy}>
            {busy ? 'Sending…' : 'Resend email'}
          </button>
          <button
            className="auth-btn primary"
            onClick={proceedIfVerified}
            disabled={busy}
          >
            {busy ? 'Checking…' : 'I verified — continue'}
          </button>
          <button className="auth-btn danger" onClick={logout}>
            Sign out
          </button>
        </div>
        <div className="auth-row">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
