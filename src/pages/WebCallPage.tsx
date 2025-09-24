import React, { useEffect, useState } from "react";
import { useDialer, e164 } from "../context/DialerContext";
import SettingsCard from "../components/SettingsCard";
import StatusPanel from "../components/StatusPanel";
import HistoryTable from "../components/HistoryTable";
import "./Phone.css";

export default function WebCallPage() {
  const {
    apiBase,
    fromPool,
    agent,
    addHistory,
    clientReady,
    activeCall,
    muted,
    registerIfNeeded,
    startCall,
    hangup,
    toggleMute,
  } = useDialer();

  const [browserTo, setBrowserTo] = useState("");
  const [browserFrom, setBrowserFrom] = useState("");
  const [sid, setSid] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-register on mount
  useEffect(() => {
    registerIfNeeded().catch((e) => setError(e.message));
  }, [apiBase, agent]);

  // Optional: auto-call via query params: ?autocall=1&to=+44...&from=+44...
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("autocall") === "1" && clientReady && !activeCall) {
      const to = url.searchParams.get("to") || "";
      const f = url.searchParams.get("from") || fromPool[0] || "";
      if (to && f) {
        setBrowserTo(to);
        setBrowserFrom(f);
        handleCall(to, f);
      }
    }
  }, [clientReady, activeCall, fromPool]);

  const handleCall = async (to: string, from: string) => {
    try {
      setError(null);
      if (!e164.test(to)) throw new Error("Enter a valid E.164 number.");
      const call = await startCall(to, from);
      setStatus("in-progress");
      const started = new Date();
      const sidLike = `client-${started.getTime()}`;
      setSid(sidLike);
      addHistory({
        sid: sidLike,
        to,
        from,
        agent: agent || "—",
        message: "(Browser call)",
        startedAt: started.toISOString(),
        status: "in-progress",
      });
      call.on("disconnect", () => setStatus("completed"));
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  // keyboard shortcut: M to toggle mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && activeCall) toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCall, toggleMute]);

  return (
    <>
      <SettingsCard />

      <section className="card">
        <h2 className="h2">Hello Web Call</h2>
        <div className={`phone ${activeCall ? "is-calling" : ""}`}>
          <div className="phone-statusbar">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <div className="notch" />
          </div>

          <div className="phone-body">
            <div className="phone-title">Browser Call</div>

            <div className="phone-hint" style={{ marginBottom: 8 }}>
              {clientReady ? "Mic ready ✓" : "Preparing microphone…"}
            </div>

            <div className="phone-field">
              <label>To (+country)</label>
              <input
                className="phone-input"
                value={browserTo}
                onChange={(e) => setBrowserTo(e.target.value.trim())}
                placeholder="+447700900123"
              />
            </div>

            <div className="phone-field">
              <label>Caller ID</label>
              <select
                className="phone-input"
                value={browserFrom}
                onChange={(e) => setBrowserFrom(e.target.value)}
              >
                <option value="">{fromPool[0] || "(Select Caller Number)"}</option>
                {fromPool.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="phone-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="phone-actions">
              <button
                className="btn btn-call"
                onClick={() => handleCall(browserTo, browserFrom || fromPool[0] || "")}
                disabled={!clientReady || !!activeCall}
              >
                Make Web Call
              </button>

              <button
                className="btn btn-mute"
                onClick={toggleMute}
                disabled={!activeCall}
                title="Mute/Unmute (M)"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>

            <div className="phone-actions phone-actions--center">
              <button
                className="btn btn-hang"
                onClick={hangup}
                disabled={!activeCall}
              >
                Hang up
              </button>
            </div>

            <p className="phone-hint">
              Calls continue while you navigate inside the app. Avoid full page refresh.
            </p>
          </div>

          <div className="phone-homebar" />
        </div>
      </section>

      <StatusPanel
        sid={sid}
        status={status}
        to={browserTo}
        from={browserFrom || fromPool[0]}
        agent={agent}
      />
      <HistoryTable />
    </>
  );
}
