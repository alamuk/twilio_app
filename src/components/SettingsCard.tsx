import { useDialer } from "../context/DialerContext";

export default function SettingsCard() {
  const { apiBase, setApiBase, fromPoolRaw, setFromPoolRaw, agent, setAgent } = useDialer();
  return (
    <section className="card">
      <h2 className="h2">Settings</h2>
      <div className="row">
        <label className="label">API Base</label>
        <input
          className="input"
          placeholder="https://xxxx.execute-api.eu-north-1.amazonaws.com"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value.trim())}
        />
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
    </section>
  );
}
