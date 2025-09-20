import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setErr(null);
      await resetPassword(email);
      setMsg('Password reset email sent.');
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Reset password</h1>
        <label>Email</label>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {err && <div className="auth-error">{err}</div>}
        {msg && <div className="auth-ok">{msg}</div>}
        <button className="auth-btn primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <div className="auth-row">
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
