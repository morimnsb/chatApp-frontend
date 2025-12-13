// src/hooks/useFetch.js
import { useEffect, useRef, useState, useCallback } from 'react';
import apiClient from '@/services/apiClient';

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

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const url = isAbsoluteUrl(path) ? path : path.replace(/^\/+/, '/');

      const resp = await apiClient.request({
        url,
        method: config.method || 'GET',
        headers: config.headers,
        params: config.params,
        data: config.body,
        signal: controller.signal,
      });

      setData(resp?.data ?? null);
      setLoading(false);
      setError(null);
      lastUrlRef.current = url;
      
    } catch (err) {
      if (controller.signal.aborted) return;

      // eslint-disable-next-line no-console
      console.error('[useFetch NETWORK/HTTP ERROR]', {
        path,
        normalized: lastUrlRef.current || path,
        err,
      });
console.log('status', err?.response?.status);
console.log('data', err?.response?.data);
console.log('content-type', err?.response?.headers?.['content-type']);

      setError(err);
      setLoading(false);
    } finally {
      abortRef.current = null;
    }
  }, [path, config.method, config.headers, config.params, config.body]);

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
