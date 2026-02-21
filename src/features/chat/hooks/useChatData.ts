// chatApp-frontend\src\features\chat\hooks\useChatData.ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch } from "@/app/store/hooks";

import apiClient from "@/shared/api/apiClient";
import { setLoading, setGroupMessages, setError } from "@/features/chat/state/messageActions";
import { toErrorMessage } from "@/shared/utils/errors";
import type { BackendPaths } from "@/shared/backend";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[useChatData]", ...a);

type UseChatDataArgs = {
  endpoints?: Partial<BackendPaths> | null;
  accessToken?: string | null; // (فعلاً لازم نیست، چون apiClient خودش token می‌خونه)
};

const isCanceled = (err: any) =>
  err?.code === "ERR_CANCELED" ||
  err?.name === "CanceledError" ||
  err?.name === "AbortError" ||
  String(err?.message || "").toLowerCase().includes("canceled");

const toArray = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.results)) return x.results;
  if (Array.isArray(x?.rooms)) return x.rooms;
  if (Array.isArray(x?.conversations)) return x.conversations;
  return [];
};

export default function useChatData(args: UseChatDataArgs = {}) {
  const dispatch = useAppDispatch();

  // ✅ prefer endpoints, fallback to legacy
  const convosPath = args.endpoints?.convos ?? "/chat/conversations/";

  const abortRef = useRef<AbortController | null>(null);
  const lastNonEmptyRef = useRef<any[] | null>(null);
  const prevMetaRef = useRef<{ loading: boolean | null; errMsg: string | null }>({
    loading: null,
    errMsg: null,
  });

  const setLoadingSafe = useCallback(
    (next: boolean) => {
      if (prevMetaRef.current.loading !== next) {
        prevMetaRef.current.loading = next;
        dispatch(setLoading(next));
      }
    },
    [dispatch]
  );

  const setErrorSafe = useCallback(
    (err: any) => {
      const msg = err ? toErrorMessage(err) : null;
      if (prevMetaRef.current.errMsg === msg) return;

      prevMetaRef.current.errMsg = msg;

      if (err) {
        dispatch(
          setError({
            type: "messages",
            errorType: "network",
            message: msg,
          })
        );
      } else {
        dispatch(setError(null));
      }
    },
    [dispatch]
  );

  const fetchConversations = useCallback(async () => {
    // cancel previous
    try {
      abortRef.current?.abort();
    } catch {}

    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingSafe(true);

    try {
      if (DEBUG) log("request conversations", { url: convosPath, baseURL: apiClient?.defaults?.baseURL });

      const res = await apiClient.get(convosPath, { signal: controller.signal });
      const roomsArr = toArray(res?.data);

      if (roomsArr.length) lastNonEmptyRef.current = roomsArr;

      // ✅ store ALL rooms (dm + group) in one list
      dispatch(setGroupMessages(roomsArr));

      setErrorSafe(null);

      if (DEBUG) log("conversations ok", { count: roomsArr.length });
      return roomsArr;
    } catch (err: any) {
      if (controller.signal.aborted || isCanceled(err)) return null;

      // keep last non-empty snapshot if exists
      if (lastNonEmptyRef.current) {
        dispatch(setGroupMessages(lastNonEmptyRef.current));
      }

      setErrorSafe(err);
      if (DEBUG) log("conversations error", err?.message || err);
      return null;
    } finally {
      setLoadingSafe(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [dispatch, convosPath, setErrorSafe, setLoadingSafe]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await fetchConversations();
    })();

    return () => {
      alive = false;
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [fetchConversations]);

  const retryConvos = useMemo(() => () => fetchConversations(), [fetchConversations]);

  // ✅ alias for legacy callers (your HomeChat / useUsersQuery)
  const retryRooms = retryConvos;

  return { retryConvos, retryRooms };
}