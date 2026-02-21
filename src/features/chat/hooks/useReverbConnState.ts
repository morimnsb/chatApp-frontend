//chatApp-frontend\src\features\chat\hooks\useReverbConnState.ts
import { useEffect, useMemo, useState } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const dlog = (...a: any[]) => DEBUG && console.log("[useReverbConnState]", ...a);

export type ReverbUiConnState =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "disconnected"
  | "unavailable"
  | "failed"
  | "unknown";

// Pusher state_change payload (کمینه)
type PusherStateChange = {
  previous?: string | null;
  current?: string | null;
};

// حداقل چیزی که از Echo/Pusher لازم داریم
type PusherConnectionLike = {
  state?: string | null;
  bind?: (event: string, cb: (payload: any) => void) => void;
  unbind?: (event: string, cb: (payload: any) => void) => void;
};

type EchoLike = {
  connector?: {
    pusher?: {
      connection?: PusherConnectionLike;
    };
  };
};

/**
 * Normalize Pusher connection states to a stable UI set
 * Pusher states (common): initialized, connecting, connected, unavailable, failed, disconnected
 */
function normalizePusherState(s: unknown): ReverbUiConnState {
  const raw = String(s || "").toLowerCase().trim();

  if (!raw) return "connecting";

  if (raw === "connected") return "connected";
  if (raw === "connecting" || raw === "initialized") return "connecting";

  if (raw === "unavailable") return "unavailable";
  if (raw === "failed") return "failed";
  if (raw === "disconnected") return "disconnected";

  // هر چیزی غیرمنتظره
  return "unknown";
}

/**
 * Decide "reconnecting" based on transitions:
 * - if previous was connected and next becomes connecting => reconnecting
 */
function deriveState(args: { prevNorm: ReverbUiConnState; nextNorm: ReverbUiConnState }): ReverbUiConnState {
  const { prevNorm, nextNorm } = args;
  if (nextNorm === "connecting" && prevNorm === "connected") return "reconnecting";
  return nextNorm;
}

type Params = {
  backendKind?: string | null;
  token?: string | null;
};

export default function useReverbConnState({ backendKind, token }: Params): ReverbUiConnState {
  const isReverb = useMemo(
    () => String(backendKind || "").toLowerCase() === "reverb",
    [backendKind]
  );

  const hasToken = useMemo(() => Boolean(String(token || "").trim()), [token]);

  // ✅ اگر reverb+token داریم، از همون اول connecting
  const [connState, setConnState] = useState<ReverbUiConnState>(() =>
    isReverb && hasToken ? "connecting" : "idle"
  );

  useEffect(() => {
    if (!isReverb || !hasToken) {
      setConnState("idle");
      return;
    }

    setConnState((s) => (s === "idle" ? "connecting" : s));

    const echo = getOrCreateEcho(token as string) as unknown as EchoLike;
    const conn = echo?.connector?.pusher?.connection;

    if (!conn) {
      setConnState("connecting");
      return;
    }

    // snapshot اولیه
    const initialNorm = normalizePusherState(conn.state);
    setConnState(initialNorm);
    dlog("init", { raw: conn.state, norm: initialNorm });

    const onStateChange = (states: PusherStateChange) => {
      const rawPrev = states?.previous ?? null;
      const rawNext = states?.current ?? conn.state ?? null;

      const prevNorm = normalizePusherState(rawPrev);
      const nextNorm = normalizePusherState(rawNext);
      const finalState = deriveState({ prevNorm, nextNorm });

      setConnState(finalState);
      dlog("state_change", {
        raw: { previous: rawPrev, current: rawNext },
        norm: { previous: prevNorm, current: nextNorm, final: finalState },
      });
    };

    const onConnected = () => {
      setConnState("connected");
      dlog("connected");
    };

    const onDisconnected = () => {
      setConnState("disconnected");
      dlog("disconnected");
    };

    const onError = (err: any) => {
      // اگر connected نیستیم، بهتره reconnecting نشون بدیم
      setConnState((prev) => (prev === "connected" ? "connected" : "reconnecting"));
      dlog("error", err?.error || err || { message: "Unknown pusher error" });
    };

    try { conn.bind?.("state_change", onStateChange as any); } catch {}
    try { conn.bind?.("connected", onConnected as any); } catch {}
    try { conn.bind?.("disconnected", onDisconnected as any); } catch {}
    try { conn.bind?.("error", onError as any); } catch {}

    return () => {
      try { conn.unbind?.("state_change", onStateChange as any); } catch {}
      try { conn.unbind?.("connected", onConnected as any); } catch {}
      try { conn.unbind?.("disconnected", onDisconnected as any); } catch {}
      try { conn.unbind?.("error", onError as any); } catch {}
    };
  }, [isReverb, hasToken, token]);

  return connState;
}