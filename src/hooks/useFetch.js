// src/hooks/useFetch.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
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

  const cleaned = p.replace(/^\/+/, '').replace(/\s+/g, '');
  return `/${cleaned}`;
}

const isCanceled = (err) =>
  err?.code === 'ERR_CANCELED' ||
  err?.name === 'CanceledError' ||
  err?.message === 'canceled' ||
  axios.isCancel?.(err) === true;

export default function useFetch(path, config = {}) {
  const immediate = config.immediate !== false;

  const [data, setData] = useState(config.initialData ?? null);
  const [loading, setLoading] = useState(Boolean(immediate));
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  const url = useMemo(() => normalizeUrl(path), [path]);

  // ✅ extract request parts so deps are stable
  const req = useMemo(
    () => ({
      method: config.method || 'GET',
      headers: config.headers,
      params: config.params,
      body: config.body,
    }),
    [config.method, config.headers, config.params, config.body],
  );

  const doFetch = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    // cancel previous request
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      log('request', {
        url,
        method: req.method,
        hasHeaders: Boolean(req.headers),
      });

      const resp = await apiClient.request({
        url,
        method: req.method,
        headers: req.headers,
        params: req.params,
        data: req.body,
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
      // ✅ canceled by us / StrictMode cleanup → ignore completely
      if (controller.signal.aborted || isCanceled(err)) return;

      console.error('[useFetch NETWORK/HTTP ERROR]', {
        url,
        err,
        status: err?.response?.status,
        data: err?.response?.data,
        contentType: err?.response?.headers?.['content-type'],
      });

      setError(err);
    } finally {
      setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [url, req.method, req.headers, req.params, req.body]);

  useEffect(() => {
    if (!immediate) return;

    doFetch();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doFetch, immediate]);

  const retry = useCallback(() => doFetch(), [doFetch]);

  return { data, loading, error, retry };
}
