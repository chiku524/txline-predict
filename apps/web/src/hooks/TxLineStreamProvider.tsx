"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface StreamMessage {
  type?: string;
  message?: string;
  fixtureId?: string;
  at?: string;
  isLive?: boolean;
}

export interface FeedEvent {
  id: string;
  type: "score" | "odds" | "status";
  message: string;
  fixtureId?: string;
  at: string;
}

interface TxLineStreamContextValue {
  connected: boolean;
  events: FeedEvent[];
  subscribe: (listener: (data: StreamMessage) => void) => () => void;
}

const TxLineStreamContext = createContext<TxLineStreamContextValue | null>(
  null
);

export function TxLineStreamProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Set<(data: StreamMessage) => void>());

  useEffect(() => {
    const es = new EventSource("/api/txline/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StreamMessage;
        setEvents((prev) => [
          {
            id: crypto.randomUUID(),
            type: (data.type as FeedEvent["type"]) ?? "status",
            message: data.message ?? "",
            fixtureId: data.fixtureId,
            at: data.at ?? new Date().toISOString(),
          },
          ...prev.slice(0, 24),
        ]);
        listenersRef.current.forEach((listener) => listener(data));
      } catch {
        /* ignore malformed payloads */
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  const subscribe = useCallback((listener: (data: StreamMessage) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <TxLineStreamContext.Provider value={{ connected, events, subscribe }}>
      {children}
    </TxLineStreamContext.Provider>
  );
}

export function useTxLineStream(): TxLineStreamContextValue {
  const ctx = useContext(TxLineStreamContext);
  if (!ctx) {
    throw new Error("useTxLineStream must be used within TxLineStreamProvider");
  }
  return ctx;
}
