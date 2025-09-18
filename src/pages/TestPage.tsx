
// {/* ignore */}// import React from "react";


import React, { useState } from "react";
import { Device } from "@twilio/voice-sdk";
import { useDialer, e164 } from "../context/DialerContext";
import SettingsCard from "../components/SettingsCard";
import StatusPanel from "../components/StatusPanel";
import HistoryTable from "../components/HistoryTable";


export default function TestPage() {
  const { apiBase, fromPool, agent, addHistory } = useDialer();

  const [dev, setDev] = useState<Device | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [activeBrowserCall, setActiveBrowserCall] = useState<any>(null);

  const [browserTo, setBrowserTo] = useState("");
  const [browserFrom, setBrowserFrom] = useState("");

  const [sid, setSid] = useState<string | null>(null);        // we’ll fill this from Twilio's returned call parameters if available
  const [status, setStatus] = useState<string | null>(null);  // lightweight status for browser call
  const [error, setError] = useState<string | null>(null);

  const getToken = async (identity: string) => {
    const res = await fetch(`${apiBase}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.message || "Token error");
    return data.token as string;
  };

  const registerClient = async () => {
    try {
      setError(null);
      if (location.protocol !== "https:" && location.hostname !== "localhost") {
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
      if (!dev || !clientReady) throw new Error('Click "Enable mic & register" first.');
      if (!e164.test(browserTo)) throw new Error("Enter a valid E.164 number for Browser Call.");
      const params: Record<string, string> = {
        To: browserTo,
        From: browserFrom || fromPool[0] || "",
      };
      const call = await dev.connect({ params });

      setStatus("in-progress");
      setActiveBrowserCall(call);

      // Twilio's JS SDK may not immediately give a PSTN SID, but we can log a local pseudo-entry
      const started = new Date();
      const sidLike = `client-${started.getTime()}`; // local tracking only
      setSid(sidLike);

      addHistory({
        sid: sidLike,
        to: browserTo,
        from: params.From,
        agent: agent || "—",
        message: "(Browser call)",
        startedAt: started.toISOString(),
        status: "in-progress",
      });

      call.on("disconnect", () => {
        setActiveBrowserCall(null);
        setStatus("completed");
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const hangupBrowser = () => {
    if (activeBrowserCall) {
      activeBrowserCall.disconnect();
      setActiveBrowserCall(null);
      setStatus("completed");
    }
  };

  return (
    <>
      <SettingsCard />

      <section className="card">
        <h2 className="h2">Hello Web Call</h2>
        <div className="row">
          <button className="primaryBtn" onClick={registerClient} disabled={clientReady}>
            {clientReady ? "Mic ready ✓" : "Enable mic & register"}
          </button>
        </div>

        <div className="grid">
          <div>
            <label className="label">To (E.164)</label>
            <input className="input" value={browserTo} onChange={(e) => setBrowserTo(e.target.value.trim())} placeholder="+447700900123" />
          </div>
          <div>
            <label className="label">Caller ID</label>
            <select className="input" value={browserFrom} onChange={(e) => setBrowserFrom(e.target.value)}>
              <option value="">(use first From)</option>
              {fromPool.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
        </div>

        {error && <div className="error"><strong>Error:</strong> {error}</div>}

        <div className="btnRow">
          <button className="primaryBtn" onClick={callFromBrowser} disabled={!clientReady}>Call from browser</button>
          <button className="secondaryBtn" onClick={hangupBrowser} disabled={!activeBrowserCall}>Hang up</button>
        </div>

        <p className="mutedSmall">
          Requires mic permission. App’s Voice URL must point to <code>/client/voice</code>.
        </p>
      </section>

      <StatusPanel sid={sid} status={status} to={browserTo} from={browserFrom || fromPool[0]} />

      <HistoryTable />
    </>
  );
}

