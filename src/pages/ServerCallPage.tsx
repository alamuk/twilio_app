import React, { useEffect, useRef, useState } from "react";
import {
  useDialer,
  e164,
  CallStatus,
  terminalStatuses,
  HistoryEntry,
} from "../context/DialerContext";
import SettingsCard from "../components/SettingsCard";
import StatusPanel from "../components/StatusPanel";
import HistoryTable from "../components/HistoryTable";
import "./Phone.css"; // re-use the phone styles

type CallResponse = {
  sid: string;
  status: CallStatus;
  to: string;
  from: string;
};

export default function ServerCallPage() {
  const { apiBase, fromPool, agent, addHistory, updateHistory } = useDialer();

  const [to, setTo] = useState("");
  const [fromNumber, setFromNumber] = useState(fromPool[0] || "");
  const [message, setMessage] = useState(
    "Hello! This is a test call from our dialer."
  );
  const [error, setError] = useState<string | null>(null);

  const [sid, setSid] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus | null>(null);
  const pollRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (fromPool.length && !fromNumber) setFromNumber(fromPool[0]);
  }, [fromPool, fromNumber]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

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
            ? Math.max(
              0,
              Math.round((ended.getTime() - startTimeRef.current) / 1000)
            )
            : undefined;
          updateHistory(id, {
            status: st,
            endedAt: ended.toISOString(),
            durationSec: dur,
          });
          stopPolling();
        }
      } catch (e: any) {
        setError(`Status error: ${e?.message || e}`);
        stopPolling();
      }
    }, 2000);
  };

  const reset = () => {
    stopPolling();
    setSid(null);
    setStatus(null);
    startTimeRef.current = null;
    setError(null);
  };

  const placeCall = async () => {
    setError(null);
    if (!apiBase) return setError("Set API Base URL first.");
    if (!e164.test(to)) return setError("Enter a valid number for Call.");
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
      const entry: HistoryEntry = {
        sid: cr.sid,
        to,
        from: fromNumber,
        agent: agent || "—",
        message,
        startedAt: started.toISOString(),
        status: cr.status,
      };
      addHistory(entry);
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
        ? Math.max(
          0,
          Math.round((ended.getTime() - startTimeRef.current) / 1000)
        )
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

  return (
    <>
      <SettingsCard />

      {/* Phone-style card */}
      <section className="card">
        <h2 className="h2">Make a Call</h2>

        <div className="phone">
          <div className="phone-statusbar">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <div className="notch" />
          </div>

          <div className="phone-body">
            <div className="phone-title">Message Dialer</div>

            <div className="phone-field">
              <label>To (E.164)</label>
              <input
                className="phone-input"
                value={to}
                onChange={(e) => setTo(e.target.value.trim())}
                placeholder="+447700900123"
              />
            </div>

            <div className="phone-field">
              <label>Caller ID</label>
              <select
                className="phone-input"
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

            <div className="phone-field">
              <label>Message</label>
              <textarea
                className="phone-textarea big"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type the text the customer will hear…"
                rows={6}
              />
            </div>

            {error && (
              <div className="phone-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="phone-actions">
              <button className="btn btn-call" onClick={placeCall}>
                Call
              </button>
              <button
                className="btn btn-mute"
                onClick={hangup}
                disabled={!sid || terminalStatuses.has((status || "") as CallStatus)}
              >
                Hang up
              </button>
              <button className="btn btn-hang" onClick={reset} disabled={!sid}>
                Reset
              </button>
            </div>
          </div>

          <div className="phone-homebar" />
        </div>
      </section>

      <StatusPanel sid={sid} status={status} to={to} from={fromNumber} agent={agent} />
      <HistoryTable />
    </>
  );
}
