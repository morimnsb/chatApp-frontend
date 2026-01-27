// src/hooks/useChatData.js
// src/hooks/useChatData.js
import { useEffect, useMemo, useRef } from 'react';
import useFetch from '@/hooks/useFetch';
import { useDispatch } from 'react-redux';
import {
  setLoading,
  setGroupMessages,
  setIndividualMessages,
  setError,
} from '@/actions/messageActions';
import { toErrorMessage } from '@/utils/errors';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[useChatData]', ...a);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

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
    };
  }, [hasToken, accessToken]);

  // ✅ guard: اگر URL یا token نداریم، useFetch بی‌جهت اجرا نشه
  const shouldFetchRooms = Boolean(roomsUrl && fetchConfig);
  const shouldFetchConvos = Boolean(convosUrl && fetchConfig);

  const {
    data: roomsRaw,
    loading: loadingRooms,
    error: errorRooms,
    retry: retryRoomsRaw,
  } = useFetch(shouldFetchRooms ? roomsUrl : null, fetchConfig);

  const {
    data: convosRaw,
    loading: loadingConvos,
    error: errorConvos,
    retry: retryConvosRaw,
  } = useFetch(shouldFetchConvos ? convosUrl : null, fetchConfig);

  // ✅ keep last good results so temporary null doesn’t wipe UI
  const lastNonEmptyRef = useRef({ rooms: null, dms: null });

  const roomsArr = useMemo(() => {
    if (!roomsRaw) return null; // یعنی هنوز جوابی نداریم
    return toArray(roomsRaw);
  }, [roomsRaw]);

  const dmPartners = useMemo(() => {
    if (!convosRaw) return null;
    // conversations endpoint shape
    if (Array.isArray(convosRaw?.partners)) return convosRaw.partners;
    // allow plain array
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

    // ✅ Rooms -> store.groupMessages (ALL rooms: private + group)
    if (roomsArr !== null) {
      if (Array.isArray(roomsArr) && roomsArr.length) lastNonEmptyRef.current.rooms = roomsArr;
      dispatch(setGroupMessages(roomsArr));
    } else if (lastNonEmptyRef.current.rooms) {
      // optional: نگه‌دار قبلی؛ dispatch نکن که دوباره re-render spam نشه
      // dispatch(setGroupMessages(lastNonEmptyRef.current.rooms));
    }

    // ✅ Conversations -> store.individualMessages (legacy list)
    // اگر convos endpoint موجود نیست، این بخش صرفاً آرایه خالی نده که DMها wipe نشن
    if (dmPartners !== null) {
      if (Array.isArray(dmPartners) && dmPartners.length) lastNonEmptyRef.current.dms = dmPartners;
      dispatch(setIndividualMessages(dmPartners));
    } else if (lastNonEmptyRef.current.dms) {
      // optional keep old
      // dispatch(setIndividualMessages(lastNonEmptyRef.current.dms));
    }

    // ✅ loading + error
    dispatch(setLoading(Boolean(loadingRooms || loadingConvos)));

    const err = errorRooms || errorConvos;
    if (err) {
      dispatch(
        setError({
          type: 'messages',
          errorType: 'network',
          message: toErrorMessage(err),
        }),
      );
    } else {
      dispatch(setError(null));
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

  // ✅ safe retry wrappers (اگر url/token نبود، crash نکنه)
  const retryRooms = useMemo(() => {
    return () => {
      if (!shouldFetchRooms) return log('retryRooms skipped (no url/token)');
      retryRoomsRaw?.();
    };
  }, [shouldFetchRooms, retryRoomsRaw]);

  const retryConvos = useMemo(() => {
    return () => {
      if (!shouldFetchConvos) return log('retryConvos skipped (no url/token)');
      retryConvosRaw?.();
    };
  }, [shouldFetchConvos, retryConvosRaw]);

  return {
    retryRooms,
    retryConvos,
  };
}
