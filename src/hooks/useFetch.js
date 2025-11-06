// src/hooks/useFetch.js
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

// اگر axiosInstance سفارشی داری، می‌توانی به جای axios از آن استفاده کنی.
// import axiosInstance from '../services/axiosInstance';

const ABSOLUTE_RE = /^(?:https?:)?\/\//i;

function isAbsoluteUrl(url) {
  return ABSOLUTE_RE.test(String(url || ''));
}

export default function useFetch(path, config = {}) {
  const [data, setData] = useState(config.initialData ?? null);
  const [loading, setLoading] = useState(Boolean(config.immediate ?? true));
  const [error, setError] = useState(null);

  const lastUrlRef = useRef(null);
  const abortRef = useRef(null);

  const doFetch = useCallback(async () => {
    if (!path) return;

    // اگر قبلاً درخواست در حال اجراست، لغوش کن
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // تشخیص URL مطلق
      const url = isAbsoluteUrl(path) ? path : path.replace(/^\/+/, '/');

      // اگر از axiosInstance با baseURL استفاده می‌کنی، این‌جا جایگزین axios کن:
      const resp = await axios.request({
        url,
        method: config.method || 'GET',
        headers: config.headers,
        data: config.body,
        signal: controller.signal,
        // با axios ساده، baseURL لحاظ نمی‌شود مگر خودت بدهی.
        // اگر می‌خواهی baseURL سراسری داشته باشی، یک axiosInstance بساز و این‌جا استفاده کن.
      });

      setData(resp?.data ?? null);
      setLoading(false);
      setError(null);
      lastUrlRef.current = url;
    } catch (err) {
      if (controller.signal.aborted) return; // لغو شد

      // لاگ مفید برای دیباگ
      // eslint-disable-next-line no-console
      console.error('[useFetch NETWORK/HTTP ERROR]', {
        path,
        normalized: lastUrlRef.current || path,
        err,
      });

      setError(err);
      setLoading(false);
    } finally {
      abortRef.current = null;
    }
  }, [path, config.method, config.headers, config.body]);

  useEffect(() => {
    if (config.immediate === false) return;
    doFetch();
    // cleanup abort on unmount
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doFetch, config.immediate]);

  const retry = useCallback(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, retry };
}
