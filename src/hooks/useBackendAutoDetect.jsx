// src/hooks/useBackendAutoDetect.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { detectBackend } from '@/api/backendDetect';
import { findWorkingWS } from '@/api/wsHelper';

/**
 * useBackendAutoDetect
 *
 * خروجی:
 *  - backend: {
 *      kind: 'laravel' | 'django' | 'unknown',
 *      me?: string,
 *      users?: string,
 *      rooms?: string,
 *      convos?: string | null,
 *      friend?: string,
 *      wsCandidates?: string[]
 *    } | null
 *  - wsUrl: string | null
 *  - refresh: () => Promise<void>
 *
 * ورودی:
 *  - accessToken: string
 *  - options?: { probeWs?: boolean, wsTimeoutMs?: number }
 */
export default function useBackendAutoDetect(accessToken, options = {}) {
  const {
    probeWs = true, // اگر نخواهیم WS تست شود، false بده
    wsTimeoutMs = 1500, // تایم‌اوت هر پروب WS
  } = options;

  const [backend, setBackend] = useState(null);
  const [wsUrl, setWsUrl] = useState(null);

  // برای جلوگیری از race condition
  const reqIdRef = useRef(0);
  const unmountedRef = useRef(false);

  const safeSetState = useCallback((setter) => {
    if (!unmountedRef.current) setter();
  }, []);

  const refresh = useCallback(async () => {
    // هر بار رفرش، یک آیدی جدید برای درخواست می‌سازیم
    const myReqId = ++reqIdRef.current;

    // اگر توکن نداریم، همه‌چیز را پاک کن
    if (!accessToken) {
      safeSetState(() => {
        setBackend(null);
        setWsUrl(null);
      });
      return;
    }

    try {
      const b = await detectBackend(accessToken);

      // اگر در میانه راه هوک دوباره اجرا شده بود، نتیجه را دور بینداز
      if (unmountedRef.current || myReqId !== reqIdRef.current) return;

      safeSetState(() => setBackend(b));

      // اگر WS probing غیرفعال است یا کاندید نداریم، wsUrl را null کن
      if (!probeWs || !b?.wsCandidates || b.wsCandidates.length === 0) {
        safeSetState(() => setWsUrl(null));
        return;
      }

      // تست وب‌سوکت‌ها
      try {
        const working = await findWorkingWS(
          b.wsCandidates,
          accessToken,
          wsTimeoutMs,
        );

        if (unmountedRef.current || myReqId !== reqIdRef.current) return;

        // ممکن است null باشد (یعنی فعلاً WS در دسترس نیست)
        safeSetState(() => setWsUrl(working || null));
      } catch (wsErr) {
        // اگر پروب WS هم خراب شد، فقط null می‌گذاریم
        if (unmountedRef.current || myReqId !== reqIdRef.current) return;
        console.warn('[useBackendAutoDetect] WS probing failed:', wsErr);
        safeSetState(() => setWsUrl(null));
      }
    } catch (err) {
      // تشخیص بک‌اند ناموفق → استیت تمیز
      if (unmountedRef.current || myReqId !== reqIdRef.current) return;
      console.warn('[useBackendAutoDetect] detectBackend failed:', err);
      safeSetState(() => {
        setBackend(null);
        setWsUrl(null);
      });
    }
  }, [accessToken, probeWs, wsTimeoutMs, safeSetState]);

  useEffect(() => {
    unmountedRef.current = false;
    refresh();
    return () => {
      unmountedRef.current = true;
    };
  }, [refresh]);

  return { backend, wsUrl, refresh };
}

