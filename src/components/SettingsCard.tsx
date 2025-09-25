import { useDialer } from '../context/DialerContext';

export default function SettingsCard() {
  const {
    apiBase,                 // read-only (from env / context)
    fromPoolRaw, setFromPoolRaw,
    agent, setAgent,
  } = useDialer();

  return (
    <section className="card">
      <div className="h2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Settings</span>
        {/* Read-only API base pill (no editing) */}
        {apiBase ? (
          <span
            title={apiBase}
            style={{
              maxWidth: '60%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#f8fafc',
              color: '#0f172a',
            }}
          >
            API: {apiBase}
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
            }}
          >
            API not configured
          </span>
        )}
      </div>

      <div className="row">
        <label className="label">From Pool</label>
        <input
          className="input"
          placeholder="+4420..., +4420..., ..."
          value={fromPoolRaw}
          onChange={(e) => setFromPoolRaw(e.target.value)}
        />
      </div>

      <div className="row">
        <label className="label">Agent</label>
        <input
          className="input"
          placeholder="Agent name"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        />
      </div>

      <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        API Base is loaded from environment and can’t be edited here.
      </p>
    </section>
  );
}
