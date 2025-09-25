import React, { useEffect, useState } from "react";
import { useDialer, e164 } from "../context/DialerContext";
import SettingsCard from "../components/SettingsCard";
import StatusPanel from "../components/StatusPanel";
import HistoryTable from "../components/HistoryTable";
import "./Phone.css";

export default function WebCallPage() {
  const {
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

  // Register Twilio Device once we land here
  useEffect(() => {
    registerIfNeeded().catch((e: any) => setError(e?.message || String(e)));
    // intentionally not adding as deps other values to avoid repeated re-registers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerIfNeeded]);

  // Optional auto-call: ?autocall=1&to=+44...&from=+44...
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("autocall") === "1" && clientReady && !activeCall) {
      const to = url.searchParams.get("to") || "";
      const f = url.searchParams.get("from") || fromPool[0] || "";
      if (to && f) {
        setBrowserTo(to);
        setBrowserFrom(f);
        void handleCall(to, f);
      }
    }
  }, [clientReady, activeCall, fromPool]); // safe to depend on these

  const handleCall = async (to: string, from: string) => {
    try {
      setError(null);
      if (!e164.test(to)) {
        throw new Error("Enter a valid E.164 number (e.g. +447700900123).");
      }
      if (!from) {
        throw new Error("Choose a Caller ID number.");
      }

      const call = await startCall(to, from);
      setStatus("in-progress");

      const started = new Date();
      const sidLike = `client-${started.getTime()}`; // local tracking (Twilio client call)
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

  // Keyboard shortcut: M = mute/unmute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && activeCall) toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCall, toggleMute]);

  // Default the Caller ID dropdown to first pool item if user hasn’t picked
  useEffect(() => {
    if (!browserFrom && fromPool.length) {
      setBrowserFrom(fromPool[0]);
    }
  }, [fromPool, browserFrom]);

  return (
    <>
      <SettingsCard />

      <section className="card">
        <h2 className="h2">Hello Web Call</h2>

        <div className={`phone ${activeCall ? "is-calling" : ""}`}>
          {/* status bar UI */}
          <div className="phone-statusbar">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <div className="notch" />
          </div>

          {/* phone screen */}
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
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div className="phone-field">
              <label>Caller ID</label>
              <select
                className="phone-input"
                value={browserFrom}
                onChange={(e) => setBrowserFrom(e.target.value)}
              >
                {fromPool.length === 0 && (
                  <option value="">— (no numbers configured) —</option>
                )}
                {fromPool.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
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
                onClick={() =>
                  handleCall(browserTo, browserFrom || fromPool[0] || "")
                }
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
              Calls continue while you navigate inside the app. Avoid full page
              refresh.
            </p>
          </div>

          {/* bottom bar */}
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
