import { CallStatus, terminalStatuses } from "../context/DialerContext";

type Props = {
  sid: string | null;
  status: CallStatus | null;
  to?: string;
  from?: string;
  agent?: string;
};

export default function StatusPanel({ sid, status, to, from, agent }: Props) {
  return (
    <section className="card">
      <h2 className="h2">Status</h2>
      <dl className="kv">
        <div className="kvRow"><dt>SID</dt><dd>{sid || "—"}</dd></div>
        <div className="kvRow"><dt>Status</dt><dd>{status || "—"}</dd></div>
        <div className="kvRow"><dt>To</dt><dd>{to || "—"}</dd></div>
        <div className="kvRow"><dt>From</dt><dd>{from || "—"}</dd></div>
        <div className="kvRow"><dt>Agent</dt><dd>{agent || "—"}</dd></div>
      </dl>
      {sid && !terminalStatuses.has((status || "") as CallStatus) && (
        <p className="mutedSmall">Polling every 2s… (Stops when completed/failed)</p>
      )}
    </section>
  );
}
