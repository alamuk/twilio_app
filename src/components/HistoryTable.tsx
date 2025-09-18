import { useDialer } from "../context/DialerContext";

export default function HistoryTable() {
  const { history, clearHistory } = useDialer();

  const exportCsv = () => {
    const header = [
      "sid","agent","to","from","status","startedAt","endedAt","durationSec","message",
    ];
    const rows = history.map((r) => [
      r.sid, r.agent, r.to, r.from, r.status, r.startedAt, r.endedAt ?? "", r.durationSec ?? "",
      (r.message || "").replace(/\n/g, " "),
    ]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((arr) => arr.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "call-history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <h2 className="h2">Call History</h2>
      <div className="btnRow mb-8">
        <button className="ghostBtn" onClick={exportCsv} disabled={!history.length}>Export CSV</button>
        <button className="secondaryBtn" onClick={clearHistory} disabled={!history.length}>Clear</button>
      </div>
      <div className="tableWrap">
        <table className="table">
          <thead>
          <tr>
            <th>Started</th><th>Agent</th><th>To</th><th>From</th>
            <th>Status</th><th>Duration</th><th>SID</th>
          </tr>
          </thead>
          <tbody>
          {history.length === 0 ? (
            <tr><td colSpan={7} className="emptyCell">No calls yet</td></tr>
          ) : (
            history.map(h => (
              <tr key={h.sid}>
                <td>{new Date(h.startedAt).toLocaleString()}</td>
                <td>{h.agent}</td>
                <td>{h.to}</td>
                <td>{h.from}</td>
                <td>{h.status}</td>
                <td>{typeof h.durationSec === "number" ? `${h.durationSec}s` : "—"}</td>
                <td className="mono">{h.sid}</td>
              </tr>
            ))
          )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
