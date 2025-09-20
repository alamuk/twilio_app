// src/components/HeaderBar.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HeaderBar() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <h1 className="title">📞 Talentpull Dialer</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {user?.email ? (
          <>
            <small className="subtitle">{user.email}</small>
            <button className="ghostBtn" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <small className="subtitle">
            <Link to="/login">Sign in</Link>
          </small>
        )}
      </div>
    </header>
  );
}
