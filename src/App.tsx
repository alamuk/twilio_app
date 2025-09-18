import React, { useEffect, useMemo, useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";

// ---------- Types ----------
type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled"
  | string;

type CallResponse = { sid: string; status: CallStatus; to: string; from: string };

type HistoryEntry = {
  sid: string;
  to: string;
  from: string;
  agent: string;
  message: string;
  startedAt: string;
  endedAt?: string;
  status: CallStatus;
  durationSec?: number;
};

const terminalStatuses = new Set<CallStatus>([
  "completed",
  "failed",
  "canceled",
  "busy",
  "no-answer",
]);

const e164 = /^\+[1-9]\d{7,14}$/;

const getEnv = (k: string): string | undefined => {
  try {
    // @ts-ignore
    return (import.meta as any)?.env?.[k] ?? (window as any)[k];
  } catch {
    return (window as any)[k];
  }
};

// ---------- Component ----------
export default function App() {
  // API + pool
  const envApi = getEnv("VITE_API_BASE");
  const [apiBase, setApiBase] = useState<string>(
    localStorage.getItem("apiBase") || envApi || ""
  );
  useEffect(() => {
    if (apiBase) localStorage.setItem("apiBase", apiBase);
  }, [apiBase]);

  const envPool = getEnv("VITE_FROM_POOL") || "";
  const [fromPoolRaw, setFromPoolRaw] = useState<string>(
    localStorage.getItem("fromPool") || envPool
  );
  useEffect(() => localStorage.setItem("fromPool", fromPoolRaw), [fromPoolRaw]);

  const fromPool = useMemo(
    () =>
      fromPoolRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [fromPoolRaw]
  );

  // Form state (server-placed call)
  const [agent, setAgent] = useState(localStorage.getItem("agent") || "");
  useEffect(() => localStorage.setItem("agent", agent), [agent]);

  const [to, setTo] = useState("");
  const [fromNumber, setFromNumber] = useState(fromPool[0] || "");
  const [message, setMessage] = useState(
    "Hello! This is a test call from our dialer."
  );
  const [error, setError] = useState<string | null>(null);

  // Active server-placed call
  const [sid, setSid] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus | null>(null);
  const pollRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (fromPool.length && !fromNumber) setFromNumber(fromPool[0]);
  }, [fromPool, fromNumber]);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem("callHistory");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("callHistory", JSON.stringify(history));
  }, [history]);

  const addHistory = (e: HistoryEntry) => {
    setHistory((h) => [e, ...h].slice(0, 500));
  };
  const updateHistory = (id: string, patch: Partial<HistoryEntry>) => {
    setHistory((h) => h.map((row) => (row.sid === id ? { ...row, ...patch } : row)));
  };

  // Poll Twilio call status
  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/status?sid=${encodeURIComponent(id)}`
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const st = (data.status || "").toString() as CallStatus;
        setStatus(st);
        if (terminalStatuses.has(st)) {
          const ended = new Date();
          const dur = startTimeRef.current
            ? Math.max(0, Math.round((ended.getTime() - startTimeRef.current) / 1000))
            : undefined;
          updateHistory(id, {
            status: st,
            endedAt: ended.toISOString(),
            durationSec: dur,
          });
          stopPolling();
        }
      } catch (e: any) {
        console.error("status error", e);
        setError(`Status error: ${e?.message || e}`);
        stopPolling();
      }
    }, 2000);
  };
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  const reset = () => {
    stopPolling();
    setSid(null);
    setStatus(null);
    startTimeRef.current = null;
    setError(null);
  };

  // CSV export
  const exportCsv = () => {
    const header = [
      "sid",
      "agent",
      "to",
      "from",
      "status",
      "startedAt",
      "endedAt",
      "durationSec",
      "message",
    ];
    const rows = history.map((r) => [
      r.sid,
      r.agent,
      r.to,
      r.from,
      r.status,
      r.startedAt,
      r.endedAt ?? "",
      r.durationSec ?? "",
      (r.message || "").replace(/\n/g, " "),
    ]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv =
      [header, ...rows].map((arr) => arr.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Server-placed call actions
  const placeCall = async () => {
    setError(null);
    if (!apiBase) return setError("Set API Base URL first.");
    if (!e164.test(to))
      return setError("Enter a valid E.164 number (e.g. +447700900123).");
    if (!fromNumber) return setError("Select a From number.");

    try {
      const res = await fetch(`${apiBase}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, from_number: fromNumber, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.message || JSON.stringify(data)
        );
      }
      const started = new Date();
      startTimeRef.current = started.getTime();
      const cr = data as CallResponse;
      setSid(cr.sid);
      setStatus(cr.status);
      addHistory({
        sid: cr.sid,
        to,
        from: fromNumber,
        agent: agent || "—",
        message,
        startedAt: started.toISOString(),
        status: cr.status,
      });
      startPolling(cr.sid);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const hangup = async () => {
    if (!sid) return;
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/hangup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.message || JSON.stringify(data)
        );
      }
      setStatus("completed");
      const ended = new Date();
      const dur = startTimeRef.current
        ? Math.max(0, Math.round((ended.getTime() - startTimeRef.current) / 1000))
        : undefined;
      updateHistory(sid, {
        status: "completed",
        endedAt: ended.toISOString(),
        durationSec: dur,
      });
      stopPolling();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  // ----------- Browser Call (WebRTC → PSTN) -----------
  const [dev, setDev] = useState<Device | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [activeBrowserCall, setActiveBrowserCall] = useState<any>(null);
  const [browserTo, setBrowserTo] = useState("");
  const [browserFrom, setBrowserFrom] = useState("");

  const getToken = async (identity: string) => {
    const res = await fetch(`${apiBase}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || data?.message || "Token error");
    }
    return data.token as string;
  };

  const registerClient = async () => {
    try {
      setError(null);
      if (
        location.protocol !== "https:" &&
        location.hostname !== "localhost"
      ) {
        throw new Error("Browser calling requires HTTPS (use CloudFront).");
      }
      if (!apiBase) throw new Error("Set API Base URL first.");

      const identity = agent || "agent";
      const token = await getToken(identity);
      const device = new Device(token, { logLevel: "error" });

      device.on("registered", () => setClientReady(true));
      device.on("error", (e) => setError(`Device error: ${e.message}`));
      await device.register();
      setDev(device);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const callFromBrowser = async () => {
    try {
      setError(null);
      if (!dev || !clientReady)
        throw new Error("Click “Enable mic & register” first.");
      if (!e164.test(browserTo))
        throw new Error("Enter a valid E.164 number for Browser Call.");
      const params: Record<string, string> = {
        To: browserTo,
        From: browserFrom || fromNumber || "",
      };
      const call = await dev.connect({ params });
      setActiveBrowserCall(call);
      call.on("disconnect", () => setActiveBrowserCall(null));
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const hangupBrowser = () => {
    if (activeBrowserCall) {
      activeBrowserCall.disconnect();
      setActiveBrowserCall(null);
    }
  };

  // ---------- UI ----------
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 20 }}>📞 Twilio Dialer</h1>
        <small style={{ opacity: 0.8 }}>FastAPI · Lambda · API Gateway</small>
      </header>

      <section style={styles.card}>
        <h2 style={styles.h2}>Settings</h2>
        <div style={styles.row}>
          <label style={styles.label}>API Base</label>
          <input
            style={styles.input}
            placeholder="https://xxxx.execute-api.eu-north-1.amazonaws.com"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value.trim())}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>From Pool</label>
          <input
            style={styles.input}
            placeholder="+4420..., +4420..., ..."
            value={fromPoolRaw}
            onChange={(e) => setFromPoolRaw(e.target.value)}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Agent</label>
          <input
            style={styles.input}
            placeholder="Agent name"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          />
        </div>
      </section>

      {/* SERVER-PLACED CALL */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Make a Call (Server-Placed)</h2>
        <div style={styles.grid}>
          <div>
            <label style={styles.label}>To (E.164)</label>
            <input
              style={styles.input}
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              placeholder="+447700900123"
            />
          </div>
          <div>
            <label style={styles.label}>From</label>
            <select
              style={styles.input}
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
            >
              <option value="">-- select --</option>
              {fromPool.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={styles.label}>Message</label>
          <textarea
            style={{ ...styles.input, height: 80, resize: "vertical" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={styles.primaryBtn} onClick={placeCall} disabled={!apiBase}>
            Call
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={hangup}
            disabled={!sid || terminalStatuses.has((status || "") as CallStatus)}
          >
            Hang up
          </button>
          <button style={styles.ghostBtn} onClick={reset} disabled={!sid}>
            Reset
          </button>
        </div>
      </section>

      {/* BROWSER CALL (WEBRTC) */}
      <section style={styles.card}>
        <h2 style={styles.h2}> Web Call </h2>
        <div style={styles.row}>
          <button
            style={styles.primaryBtn}
            onClick={registerClient}
            disabled={clientReady}
          >
            {clientReady ? "Mic ready ✓" : "Enable mic & register"}
          </button>
        </div>
        <div style={styles.grid}>
          <div>
            <label style={styles.label}>To (E.164)</label>
            <input
              style={styles.input}
              value={browserTo}
              onChange={(e) => setBrowserTo(e.target.value.trim())}
              placeholder="+447700900123"
            />
          </div>
          <div>
            <label style={styles.label}>Caller ID</label>
            <select
              style={styles.input}
              value={browserFrom}
              onChange={(e) => setBrowserFrom(e.target.value)}
            >
              <option value="">(use selected From)</option>
              {fromPool.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            style={styles.primaryBtn}
            onClick={callFromBrowser}
            disabled={!clientReady}
          >
            Call from browser
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={hangupBrowser}
            disabled={!activeBrowserCall}
          >
            Hang up
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Requires HTTPS (CloudFront) and mic permission. Your TwiML App’s Voice
          URL must point to <code>/client/voice</code>.
        </p>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Status</h2>
        <dl style={styles.kv}>
          <div style={styles.kvRow}>
            <dt>SID</dt>
            <dd>{sid || "—"}</dd>
          </div>
          <div style={styles.kvRow}>
            <dt>Status</dt>
            <dd>{status || "—"}</dd>
          </div>
          <div style={styles.kvRow}>
            <dt>To</dt>
            <dd>{to || "—"}</dd>
          </div>
          <div style={styles.kvRow}>
            <dt>From</dt>
            <dd>{fromNumber || "—"}</dd>
          </div>
          <div style={styles.kvRow}>
            <dt>Agent</dt>
            <dd>{agent || "—"}</dd>
          </div>
        </dl>
        {sid && !terminalStatuses.has((status || "") as CallStatus) && (
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Polling every 2s… (Stops when completed/failed)
          </p>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Call History</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            style={styles.ghostBtn}
            onClick={exportCsv}
            disabled={!history.length}
          >
            Export CSV
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => setHistory([])}
            disabled={!history.length}
          >
            Clear
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table as React.CSSProperties}>
            <thead>
              <tr>
                <th>Started</th>
                <th>Agent</th>
                <th>To</th>
                <th>From</th>
                <th>Status</th>
                <th>Duration</th>
                <th>SID</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", opacity: 0.7, padding: 12 }}
                  >
                    No calls yet
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.sid}>
                    <td>{new Date(h.startedAt).toLocaleString()}</td>
                    <td>{h.agent}</td>
                    <td>{h.to}</td>
                    <td>{h.from}</td>
                    <td>{h.status}</td>
                    <td>
                      {typeof h.durationSec === "number"
                        ? `${h.durationSec}s`
                        : "—"}
                    </td>
                    <td
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {h.sid}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer
        style={{
          textAlign: "center",
          fontSize: 12,
          opacity: 0.7,
          marginTop: 24,
        }}
      >
        Tip: Add your hosted origin to AllowedOrigins in SAM for clean CORS.
      </footer>
    </div>
  );
}

// ---------- Styles ----------
const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1000,
    margin: "24px auto",
    padding: 16,
    fontFamily:
      "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    background: "white",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  h2: { margin: 0, marginBottom: 12, fontSize: 16 },
  row: { display: "flex", gap: 12, alignItems: "center", marginTop: 8 },
  label: { width: 110, fontSize: 13, opacity: 0.9 },
  input: {
    flex: 1,
    fontSize: 14,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    outline: "none",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  primaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #0ea5e9",
    background: "#0ea5e9",
    color: "white",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ef4444",
    background: "white",
    color: "#ef4444",
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    cursor: "pointer",
  },
  error: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
  },
  kv: { margin: 0 },
  kvRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    padding: "6px 0",
    borderTop: "1px dashed #e5e7eb",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};
