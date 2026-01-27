// src/hooks/useFetch.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import apiClient from '@/services/apiClient';

const ABSOLUTE_RE = /^(?:https?:)?\/\//i;
const isAbsoluteUrl = (url) => ABSOLUTE_RE.test(String(url || ''));

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[useFetch]', ...a);

// ✅ ensure a relative path becomes "/something"
function normalizeUrl(path) {
  const p = String(path || '').trim();
  if (!p) return null;
  if (isAbsoluteUrl(p)) return p;

  // remove leading/trailing spaces; ensure exactly one leading slash
  const cleaned = p.replace(/^\/+/, '').replace(/\s+/g, '');
  return `/${cleaned}`;
}

export default function useFetch(path, config = {}) {
  const [data, setData] = useState(config.initialData ?? null);
  const [loading, setLoading] = useState(Boolean(config.immediate ?? true));
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  // ✅ keep normalized url stable
  const url = useMemo(() => normalizeUrl(path), [path]);

  const doFetch = useCallback(async () => {
    // اگر url نداریم، fetch نکن و loading رو خاموش کن که UI گیر نکنه
    if (!url) {
      setLoading(false);
      return;
    }

    // cancel previous request if exists
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      log('request', {
        url,
        method: config.method || 'GET',
        hasHeaders: Boolean(config.headers),
      });

      const resp = await apiClient.request({
        url,
        method: config.method || 'GET',
        headers: config.headers,
        params: config.params,
        data: config.body,
        signal: controller.signal,
      });

      setData(resp?.data ?? null);
      setError(null);

      log('response', {
        url,
        status: resp?.status,
        dataType: resp?.data == null ? null : Array.isArray(resp.data) ? 'array' : typeof resp.data,
      });
    } catch (err) {
      // اگر خودمون abort کردیم، خطا نده
      if (controller.signal.aborted) return;

      // eslint-disable-next-line no-console
      console.error('[useFetch NETWORK/HTTP ERROR]', {
        url,
        err,
        status: err?.response?.status,
        data: err?.response?.data,
        contentType: err?.response?.headers?.['content-type'],
      });

      setError(err);
    } finally {
      // ✅ always stop loading
      setLoading(false);
      // فقط اگر همین controller هنوز active است پاکش کن
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [url, config.method, config.headers, config.params, config.body]);

  useEffect(() => {
    if (config.immediate === false) return;

    doFetch();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doFetch, config.immediate]);

  const retry = useCallback(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, retry };
}
