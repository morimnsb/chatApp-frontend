// src/hooks/useChatData.js
import { useEffect, useMemo, useRef } from 'react';
import useFetch from '@/shared/hooks/useFetch';
import { useDispatch } from 'react-redux';
import {
  setLoading,
  setGroupMessages,
  setIndividualMessages,
  setError,
} from '@/features/chat/state/messageActions';
import { toErrorMessage } from '@/shared/utils/errors';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[useChatData]', ...a);

const toArray = (x) => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.results)) return x.results;
  if (Array.isArray(x?.rooms)) return x.rooms;
  return [];
};

export default function useChatData({ endpoints, accessToken }) {
  const dispatch = useDispatch();

  const hasToken = Boolean(accessToken);
  const roomsUrl = endpoints?.rooms || null;
  const convosUrl = endpoints?.convos || null;

  const fetchConfig = useMemo(() => {
    if (!hasToken) return null;
    return {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      immediate: true,
    };
  }, [hasToken, accessToken]);

  const shouldFetchRooms = Boolean(roomsUrl && fetchConfig);
  const shouldFetchConvos = Boolean(convosUrl && fetchConfig);

  const {
    data: roomsRaw,
    loading: loadingRooms,
    error: errorRooms,
    retry: retryRoomsRaw,
  } = useFetch(shouldFetchRooms ? roomsUrl : null, fetchConfig || { immediate: false });

  const {
    data: convosRaw,
    loading: loadingConvos,
    error: errorConvos,
    retry: retryConvosRaw,
  } = useFetch(shouldFetchConvos ? convosUrl : null, fetchConfig || { immediate: false });

  const lastNonEmptyRef = useRef({ rooms: null, dms: null });
  const prevMetaRef = useRef({ loading: null, errMsg: null });

  const roomsArr = useMemo(() => {
    if (!roomsRaw) return null;
    return toArray(roomsRaw);
  }, [roomsRaw]);

  const dmPartners = useMemo(() => {
    if (!convosRaw) return null;
    if (Array.isArray(convosRaw?.partners)) return convosRaw.partners;
    if (Array.isArray(convosRaw)) return convosRaw;
    if (Array.isArray(convosRaw?.results)) return convosRaw.results;
    if (Array.isArray(convosRaw?.data)) return convosRaw.data;
    return [];
  }, [convosRaw]);

  useEffect(() => {
    if (DEBUG) {
      log('tick', {
        hasToken,
        roomsUrl,
        convosUrl,
        shouldFetchRooms,
        shouldFetchConvos,
        roomsRawType: roomsRaw == null ? null : Array.isArray(roomsRaw) ? 'array' : typeof roomsRaw,
        convosRawType: convosRaw == null ? null : Array.isArray(convosRaw) ? 'array' : typeof convosRaw,
      });
    }

    // ✅ rooms -> groupMessages
    if (roomsArr !== null) {
      if (roomsArr.length) lastNonEmptyRef.current.rooms = roomsArr;
      dispatch(setGroupMessages(roomsArr));
    }

    // ✅ dm partners -> individualMessages
    if (dmPartners !== null) {
      if (dmPartners.length) lastNonEmptyRef.current.dms = dmPartners;
      dispatch(setIndividualMessages(dmPartners));
    }

    // ✅ loading (avoid spam dispatch)
    const nextLoading = Boolean(loadingRooms || loadingConvos);
    if (prevMetaRef.current.loading !== nextLoading) {
      prevMetaRef.current.loading = nextLoading;
      dispatch(setLoading(nextLoading));
    }

    // ✅ error (avoid spam dispatch)
    const err = errorRooms || errorConvos;
    const msg = err ? toErrorMessage(err) : null;
    if (prevMetaRef.current.errMsg !== msg) {
      prevMetaRef.current.errMsg = msg;
      if (err) {
        dispatch(
          setError({
            type: 'messages',
            errorType: 'network',
            message: msg,
          }),
        );
      } else {
        dispatch(setError(null));
      }
    }
  }, [
    dispatch,
    hasToken,
    roomsUrl,
    convosUrl,
    shouldFetchRooms,
    shouldFetchConvos,
    roomsRaw,
    convosRaw,
    roomsArr,
    dmPartners,
    loadingRooms,
    loadingConvos,
    errorRooms,
    errorConvos,
  ]);

  const retryRooms = useMemo(() => {
    return () => {
      if (!shouldFetchRooms) return DEBUG && log('retryRooms skipped (no url/token)');
      retryRoomsRaw?.();
    };
  }, [shouldFetchRooms, retryRoomsRaw]);

  const retryConvos = useMemo(() => {
    return () => {
      if (!shouldFetchConvos) return DEBUG && log('retryConvos skipped (no url/token)');
      retryConvosRaw?.();
    };
  }, [shouldFetchConvos, retryConvosRaw]);

  return { retryRooms, retryConvos };
}



