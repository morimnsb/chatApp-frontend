// src/features/chat/hooks/useReverbConnState.js
import { useEffect, useMemo, useState } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const dlog = (...a) => DEBUG && console.log("[useReverbConnState]", ...a);

/**
 * Normalize Pusher connection states to a stable UI set
 * Pusher states (common): initialized, connecting, connected, unavailable, failed, disconnected
 */
function normalizePusherState(s) {
  const raw = String(s || "").toLowerCase().trim();

  // پُشر بعضی وقت‌ها undefined/empty میده
  if (!raw) return "connecting";

  if (raw === "connected") return "connected";
  if (raw === "connecting" || raw === "initialized") return "connecting";

  // unavailable = شبکه/سرور موقتاً در دسترس نیست
  if (raw === "unavailable") return "unavailable";

  // failed = دیگه عملاً امیدی به reconnect خودکار نیست (یا خیلی بد)
  if (raw === "failed") return "failed";

  // disconnected = قطع شده (ممکنه بعداً reconnect بشه)
  if (raw === "disconnected") return "disconnected";

  // fallback
  return raw;
}

/**
 * Decide "reconnecting" based on transitions:
 * - if previous was connected and next becomes connecting => reconnecting
 * - if we got error while not connected => treat as reconnecting (UI-friendly)
 */
function deriveState({ prevNorm, nextNorm }) {
  if (nextNorm === "connecting" && prevNorm === "connected") return "reconnecting";
  return nextNorm;
}

export default function useReverbConnState({ backendKind, token }) {
  const isReverb = useMemo(
    () => String(backendKind || "").toLowerCase() === "reverb",
    [backendKind]
  );

  const hasToken = useMemo(() => Boolean(String(token || "").trim()), [token]);

  // ✅ اگر reverb+token داریم، از همون اول connecting
  const [connState, setConnState] = useState(() =>
    isReverb && hasToken ? "connecting" : "idle"
  );

  useEffect(() => {
    if (!isReverb || !hasToken) {
      setConnState("idle");
      return;
    }

    // حداقل unknown نشیم
    setConnState((s) => (s === "idle" ? "connecting" : s));

    const echo = getOrCreateEcho(token);
    const conn = echo?.connector?.pusher?.connection;

    if (!conn) {
      setConnState("connecting");
      return;
    }

    // snapshot اولیه
    const initialNorm = normalizePusherState(conn.state);
    setConnState(initialNorm);
    dlog("init", { raw: conn.state, norm: initialNorm });

    const onStateChange = (states) => {
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

    // اینا همیشه همه‌جا fire نمی‌شن، ولی خوبه داشته باشیم
    const onConnected = () => {
      setConnState("connected");
      dlog("connected");
    };

    const onDisconnected = () => {
      // اگر بعد از connected قطع شد، disconnected
      setConnState((prev) => (prev === "connected" ? "disconnected" : "disconnected"));
      dlog("disconnected");
    };

    const onError = (err) => {
      // error الزاماً state رو عوض نمی‌کنه
      // اگر connected نیستیم، UI بهتره reconnecting/connecting نشون بده
      setConnState((prev) => (prev === "connected" ? "connected" : "reconnecting"));
      dlog("error", err?.error || err || { message: "Unknown pusher error" });
    };

    try { conn.bind?.("state_change", onStateChange); } catch {}
    try { conn.bind?.("connected", onConnected); } catch {}
    try { conn.bind?.("disconnected", onDisconnected); } catch {}
    try { conn.bind?.("error", onError); } catch {}

    return () => {
      try { conn.unbind?.("state_change", onStateChange); } catch {}
      try { conn.unbind?.("connected", onConnected); } catch {}
      try { conn.unbind?.("disconnected", onDisconnected); } catch {}
      try { conn.unbind?.("error", onError); } catch {}
    };
  }, [isReverb, hasToken, token]);

  return connState;
}
