// src/context/DialerContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Device, Call } from "@twilio/voice-sdk";

/* =========================
   Shared types & constants
   ========================= */
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

/* =========================
   Env helpers
   ========================= */
const getEnv = (k: string): string | undefined => {
  try {
    // Vite at build-time; window.* as optional runtime override
    // @ts-ignore
    return (import.meta as any)?.env?.[k] ?? (window as any)[k];
  } catch {
    return (window as any)[k];
  }
};

// // API base is read-only from env (not user-editable in UI)
// const API_BASE = (getEnv("VITE_API_BASE") || "").replace(/\/+$/, "");

/* =========================
   Context shape
   ========================= */
type Ctx = {
  // Settings (apiBase is exposed read-only so the app can display it if needed)
  apiBase: string;
  fromPoolRaw: string;
  setFromPoolRaw: (v: string) => void;
  fromPool: string[];
  agent: string;
  setAgent: (v: string) => void;

  // History
  history: HistoryEntry[];
  addHistory: (e: HistoryEntry) => void;
  updateHistory: (sid: string, patch: Partial<HistoryEntry>) => void;
  clearHistory: () => void;

  // Twilio state/actions
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

/* =========================
   Provider
   ========================= */
export const DialerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  /* ---------- settings (persisted locally) ---------- */
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

  /* ---------- Twilio state ---------- */
  const deviceRef = useRef<Device | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);

  // Warn before closing while in a call
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeCall) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeunload as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    function onBeforeunload(e: BeforeUnloadEvent) {
      // typed helper for removeEventListener reference
    }
  }, [activeCall]);

  /* ---------- token helper ---------- */
  const RAW_API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
  
  const fetchToken = async (identity: string): Promise<string> => {
    if (!API_BASE) {
      throw new Error(
        "Missing VITE_API_BASE. Set it in .env(.local) and restart the dev server."
      );
    }
    const res = await fetch(`${API_BASE}/api/token`, {
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

  /* ---------- register device if needed ---------- */
  const registerIfNeeded = async () => {
    // No agent identity yet or already registered
    if (deviceRef.current || !agent) return;

    // Require HTTPS unless localhost
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      throw new Error("Browser calling requires HTTPS (CloudFront).");
    }

    const token = await fetchToken(agent);
    const dev = new Device(token, { logLevel: "error" });

    dev.on("registered", () => setClientReady(true));
    dev.on("error", (e) => console.error("Device error:", e.message));
    dev.on("disconnect", () => {
      setActiveCall(null);
      setMuted(false);
    });

    // Auto-refresh JWT before expiry
    dev.on("tokenWillExpire", async () => {
      try {
        const fresh = await fetchToken(agent);
        await dev.updateToken(fresh);
      } catch (err) {
        console.error("Failed to refresh Twilio token:", err);
      }
    });

    await dev.register();
    deviceRef.current = dev;
  };

  // Auto-register when agent becomes available
  useEffect(() => {
    registerIfNeeded().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        deviceRef.current?.unregister?.();
        deviceRef.current?.destroy?.();
      } catch { }
      deviceRef.current = null;
    };
  }, []);

  /* ---------- call controls ---------- */
  const startCall = async (to: string, fromNumber: string) => {
    if (!deviceRef.current || !clientReady) {
      throw new Error("Mic/Device not ready yet.");
    }
    const call = await deviceRef.current.connect({
      params: { To: to, From: fromNumber },
    });
    setActiveCall(call);
    setMuted(false);

    call.on("disconnect", () => {
      setActiveCall(null);
      setMuted(false);
    });
    call.on("mute", (isMuted: boolean) => setMuted(isMuted));

    return call;
  };

  const hangup = () => {
    activeCall?.disconnect();
  };

  const toggleMute = () => {
    if (!activeCall) return;
    const next = !muted;
    activeCall.mute(next);
    setMuted(next);
  };

  /* ---------- context value ---------- */
  const value: Ctx = {
    apiBase: API_BASE, // read-only exposure
    fromPoolRaw,
    setFromPoolRaw,
    fromPool,
    agent,
    setAgent,

    history,
    addHistory,
    updateHistory,
    clearHistory,

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

/* =========================
   Hook
   ========================= */
export const useDialer = () => {
  const v = useContext(DialerCtx);
  if (!v) throw new Error("useDialer must be used inside <DialerProvider>");
  return v;
};
