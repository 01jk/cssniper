import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export interface BotStatus {
    isRunning: boolean;
    pid: number | null;
    uptime: number;       // seconds (live counter)
    startedAt: Date | null;
    scanLatency: number; // New: scan execution time in seconds
}

export interface PingInfo {
    latency_ms: number | null;
    ok: boolean;
}

interface BotStatusContextType {
    botStatus: BotStatus;
    ping: PingInfo | null;
    toggleBot: () => void;
    fetchPing: () => Promise<void>;
    isToggling: boolean;
    error: string | null;
}

const BotStatusContext = createContext<BotStatusContextType | undefined>(undefined);

export const BotStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [botStatus, setBotStatus] = useState<BotStatus>({
        isRunning: false,
        pid: null,
        uptime: 0,
        startedAt: null,
        scanLatency: 0,
    });
    const [ping, setPing] = useState<PingInfo | null>(null);
    const [isToggling, setIsToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const startedAtRef = useRef<Date | null>(null);

    const fetchPing = useCallback(async () => {
        try {
            const res = await fetch("/api/ping/csfloat");
            if (!res.ok) return;
            const data = await res.json();
            setPing(data.results?.[0] ?? null);
        } catch {
            setPing({ latency_ms: null, ok: false });
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/bot/status");
            if (!res.ok) return;
            const data = await res.json();

            let startedAt: Date | null = null;
            if (data.running && data.start_time) {
                startedAt = new Date(data.start_time);
            }
            startedAtRef.current = startedAt;

            setBotStatus((prev) => ({
                isRunning: data.running,
                pid: data.pid ?? null,
                uptime: startedAt
                    ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
                    : 0,
                startedAt,
                scanLatency: data.scan_latency ?? 0,
            }));
        } catch {
            // silent — uptime counter will continue from last known value
        }
    }, []);

    // Poll status every 30s, ping every 5s
    useEffect(() => {
        fetchStatus();
        fetchPing();
        const statusIv = setInterval(fetchStatus, 3000);
        const pingIv = setInterval(fetchPing, 5000);
        return () => {
            clearInterval(statusIv);
            clearInterval(pingIv);
        };
    }, [fetchStatus, fetchPing]);

    // Live uptime counter (ticks every second)
    useEffect(() => {
        if (!botStatus.isRunning || !startedAtRef.current) return;
        const iv = setInterval(() => {
            if (!startedAtRef.current) return;
            const secs = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
            setBotStatus((prev) => ({ ...prev, uptime: secs }));
        }, 1000);
        return () => clearInterval(iv);
    }, [botStatus.isRunning]);

    const toggleBot = useCallback(async () => {
        setIsToggling(true);
        setError(null);
        const endpoint = botStatus.isRunning ? "/api/bot/stop" : "/api/bot/start";
        try {
            const res = await fetch(endpoint, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Unknown error" }));
                throw new Error(err.detail || "Action failed");
            }
            // Refresh status immediately and again after short delay
            fetchStatus();
            setTimeout(fetchStatus, 600);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsToggling(false);
        }
    }, [botStatus.isRunning, fetchStatus]);

    return (
        <BotStatusContext.Provider value={{ botStatus, ping, toggleBot, fetchPing, isToggling, error }}>
            {children}
        </BotStatusContext.Provider>
    );
};

export const useBotStatus = () => {
    const ctx = useContext(BotStatusContext);
    if (!ctx) throw new Error("useBotStatus must be used within BotStatusProvider");
    return ctx;
};
