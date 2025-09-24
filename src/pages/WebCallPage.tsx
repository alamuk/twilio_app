import React, { useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import { useDialer, e164 } from '../context/DialerContext';
import SettingsCard from '../components/SettingsCard';
import StatusPanel from '../components/StatusPanel';
import HistoryTable from '../components/HistoryTable';
import './Phone.css';

export default function WebCallPage() {
  const { apiBase, fromPool, agent, addHistory } = useDialer();

  const [dev, setDev] = useState<Device | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [activeBrowserCall, setActiveBrowserCall] = useState<any>(null);

  const [browserTo, setBrowserTo] = useState('');
  const [browserFrom, setBrowserFrom] = useState('');

  const [sid, setSid] = useState<string | null>(null); // we’ll fill this from Twilio's returned call parameters if available
  const [status, setStatus] = useState<string | null>(null); // lightweight status for browser call
  const [error, setError] = useState<string | null>(null);

  const getToken = async (identity: string) => {
    const res = await fetch(`${apiBase}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data?.detail || data?.message || 'Token error');
    return data.token as string;
  };

  const registerClient = async () => {
    try {
      setError(null);
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Browser calling requires HTTPS (use CloudFront).');
      }
      if (!apiBase) throw new Error('Set API Base URL first.');

      const identity = agent || 'agent';
      const token = await getToken(identity);
      const device = new Device(token, { logLevel: 'error' });
      device.on('registered', () => setClientReady(true));
      device.on('error', (e) => setError(`Device error: ${e.message}`));
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
        throw new Error('Click "Enable mic & register" first.');
      if (!e164.test(browserTo))
        throw new Error('Enter a valid number for Call.');
      const params: Record<string, string> = {
        To: browserTo,
        From: browserFrom || fromPool[0] || '',
      };
      const call = await dev.connect({ params });

      setStatus('in-progress');
      setActiveBrowserCall(call);

      // Twilio's JS SDK may not immediately give a PSTN SID, but we can log a local pseudo-entry
      const started = new Date();
      const sidLike = `client-${started.getTime()}`; // local tracking only
      setSid(sidLike);

      addHistory({
        sid: sidLike,
        to: browserTo,
        from: params.From,
        agent: agent || '—',
        message: '(Browser call)',
        startedAt: started.toISOString(),
        status: 'in-progress',
      });

      call.on('disconnect', () => {
        setActiveBrowserCall(null);
        setStatus('completed');
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const hangupBrowser = () => {
    if (activeBrowserCall) {
      activeBrowserCall.disconnect();
      setActiveBrowserCall(null);
      setStatus('completed');
    }
  };

  return (
    <>
      <SettingsCard />

      {/* Hello Web Call (phone-style) */}
      <section className="card">
        <h2 className="h2">Hello Web Call</h2>
        <div className={`phone ${activeBrowserCall ? 'is-calling' : ''}`}>
          {/* <div className="phone"> */}
          {/* Status bar + notch */}
          <div className="phone-statusbar">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <div className="notch" />
          </div>

          {/* Screen content */}
          <div className="phone-body">
            <div className="phone-title">Browser Call</div>

            <div className="phone-row">
              <button
                className="btn btn-primary block"
                onClick={registerClient}
                disabled={clientReady}
              >
                {clientReady ? 'Mic ready ✓' : 'Enable mic & register'}
              </button>
            </div>

            <div className="phone-field">
              <label>To (+44) </label>
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
                <option value="">(Select Caller Number)</option>
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
                onClick={callFromBrowser}
                disabled={!clientReady}
              >
                Make Web Call 
              </button>
              <button
                className="btn btn-hang"
                onClick={hangupBrowser}
                disabled={!activeBrowserCall}
              >
                Hang up
              </button>
            </div>

            <p className="phone-hint">
              Require mic permission, Customer phone number and Your caller
              number to make a call.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="phone-homebar" />
        </div>
      </section>

      <StatusPanel
        sid={sid}
        status={status}
        to={browserTo}
        from={browserFrom || fromPool[0]}
      />
      <HistoryTable />
    </>
  );
}
