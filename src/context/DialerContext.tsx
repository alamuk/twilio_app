import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Device, Call } from "@twilio/voice-sdk";

/* ---------- types you already had ---------- */
export type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled"
  | string;

export type HistoryEntry = {
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

export const terminalStatuses = new Set<CallStatus>([
  "completed",
  "failed",
  "canceled",
  "busy",
  "no-answer",
]);
export const e164 = /^\+[1-9]\d{7,14}$/;

const getEnv = (k: string): string | undefined => {
  try {
    // @ts-ignore
    return (import.meta as any)?.env?.[k] ?? (window as any)[k];
  } catch {
    return (window as any)[k];
  }
};

/* ---------- context shape (adds Twilio state + actions) ---------- */
type Ctx = {
  apiBase: string;
  setApiBase: (v: string) => void;
  fromPoolRaw: string;
  setFromPoolRaw: (v: string) => void;
  fromPool: string[];
  agent: string;
  setAgent: (v: string) => void;

  // history (unchanged)
  history: HistoryEntry[];
  addHistory: (e: HistoryEntry) => void;
  updateHistory: (sid: string, patch: Partial<HistoryEntry>) => void;
  clearHistory: () => void;

  // Twilio JS SDK (new)
  device: Device | null;
  clientReady: boolean;
  activeCall: Call | null;
  muted: boolean;

  registerIfNeeded: () => Promise<void>;
  startCall: (to: string, fromNumber: string) => Promise<Call>;
  hangup: () => void;
  toggleMute: () => void;
};

const DialerCtx = createContext<Ctx | null>(null);

export const DialerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  /* ---------- settings ---------- */
  const envApi = getEnv("VITE_API_BASE");
  const [apiBase, setApiBase] = useState(
    localStorage.getItem("apiBase") || envApi || ""
  );
  useEffect(() => localStorage.setItem("apiBase", apiBase), [apiBase]);

  const envPool = getEnv("VITE_FROM_POOL") || "";
  const [fromPoolRaw, setFromPoolRaw] = useState(
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

  const [agent, setAgent] = useState(localStorage.getItem("agent") || "");
  useEffect(() => localStorage.setItem("agent", agent), [agent]);

  /* ---------- history ---------- */
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("callHistory") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("callHistory", JSON.stringify(history));
  }, [history]);

  const addHistory = (e: HistoryEntry) =>
    setHistory((h) => [e, ...h].slice(0, 500));
  const updateHistory = (sid: string, patch: Partial<HistoryEntry>) =>
    setHistory((h) => h.map((r) => (r.sid === sid ? { ...r, ...patch } : r)));
  const clearHistory = () => setHistory([]);

  /* ---------- Twilio Device + Call live here (persist across pages) ---------- */
  const deviceRef = useRef<Device | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);

  // keep user from closing tab mid-call
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeCall) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeCall]);

  // fetch JWT and register device if needed (auto-called on mount)
  const registerIfNeeded = async () => {
    if (deviceRef.current || !apiBase || !agent) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      throw new Error("Browser calling requires HTTPS (CloudFront).");
    }

    const res = await fetch(`${apiBase}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: agent || "agent" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.message || "Token error");

    const dev = new Device(data.token, { logLevel: "error" });
    dev.on("registered", () => setClientReady(true));
    dev.on("error", (e) => console.error("Device error:", e.message));
    dev.on("disconnect", () => { setActiveCall(null); setMuted(false); });

    await dev.register();
    deviceRef.current = dev;
  };

  // auto-register whenever apiBase + agent exist
  useEffect(() => {
    registerIfNeeded().catch(console.error);
  }, [apiBase, agent]);

  const startCall = async (to: string, fromNumber: string) => {
    if (!deviceRef.current || !clientReady) {
      throw new Error("Mic/Device not ready yet.");
    }
    const call = await deviceRef.current.connect({ params: { To: to, From: fromNumber } });
    setActiveCall(call);
    setMuted(false);
    call.on("disconnect", () => { setActiveCall(null); setMuted(false); });
    call.on("mute", (isMuted: boolean) => setMuted(isMuted));
    return call;
  };

  const hangup = () => { activeCall?.disconnect(); };
  const toggleMute = () => {
    if (!activeCall) return;
    const next = !muted;
    activeCall.mute(next);
    setMuted(next);
  };

  const value: Ctx = {
    apiBase, setApiBase,
    fromPoolRaw, setFromPoolRaw, fromPool,
    agent, setAgent,

    history, addHistory, updateHistory, clearHistory,

    device: deviceRef.current,
    clientReady,
    activeCall,
    muted,

    registerIfNeeded,
    startCall,
    hangup,
    toggleMute,
  };

  return <DialerCtx.Provider value={value}>{children}</DialerCtx.Provider>;
};

export const useDialer = () => {
  const v = useContext(DialerCtx);
  if (!v) throw new Error("useDialer must be used inside <DialerProvider>");
  return v;
};
