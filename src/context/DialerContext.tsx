import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled'
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
  'completed',
  'failed',
  'canceled',
  'busy',
  'no-answer',
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

type Ctx = {
  apiBase: string;
  setApiBase: (v: string) => void;
  fromPoolRaw: string;
  setFromPoolRaw: (v: string) => void;
  fromPool: string[];
  agent: string;
  setAgent: (v: string) => void;

  history: HistoryEntry[];
  addHistory: (e: HistoryEntry) => void;
  updateHistory: (sid: string, patch: Partial<HistoryEntry>) => void;
  clearHistory: () => void;
};

const DialerCtx = createContext<Ctx | null>(null);

export const DialerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // settings
  const envApi = getEnv('VITE_API_BASE');
  const [apiBase, setApiBase] = useState(
    localStorage.getItem('apiBase') || envApi || ''
  );
  useEffect(() => {
    localStorage.setItem('apiBase', apiBase);
  }, [apiBase]);

  const envPool = getEnv('VITE_FROM_POOL') || '';
  const [fromPoolRaw, setFromPoolRaw] = useState(
    localStorage.getItem('fromPool') || envPool
  );
  useEffect(() => {
    localStorage.setItem('fromPool', fromPoolRaw);
  }, [fromPoolRaw]);

  const fromPool = useMemo(
    () =>
      fromPoolRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [fromPoolRaw]
  );

  const [agent, setAgent] = useState(localStorage.getItem('agent') || '');
  useEffect(() => {
    localStorage.setItem('agent', agent);
  }, [agent]);

  // history
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('callHistory') || '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem('callHistory', JSON.stringify(history));
  }, [history]);

  const addHistory = (e: HistoryEntry) =>
    setHistory((h) => [e, ...h].slice(0, 500));
  const updateHistory = (sid: string, patch: Partial<HistoryEntry>) =>
    setHistory((h) => h.map((r) => (r.sid === sid ? { ...r, ...patch } : r)));
  const clearHistory = () => setHistory([]);

  const value: Ctx = {
    apiBase,
    setApiBase,
    fromPoolRaw,
    setFromPoolRaw,
    fromPool,
    agent,
    setAgent,
    history,
    addHistory,
    updateHistory,
    clearHistory,
  };

  return <DialerCtx.Provider value={value}>{children}</DialerCtx.Provider>;
};

export const useDialer = () => {
  const v = useContext(DialerCtx);
  if (!v) throw new Error('useDialer must be used inside <DialerProvider>');
  return v;
};
