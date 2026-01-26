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

const toArray = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.results) ? x.results : []);

export default function useChatData({ endpoints, accessToken }) {
  const dispatch = useDispatch();

  const fetchConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const {
    data: convos,
    loading: loadingConvos,
    error: errorConvos,
    retry: retryConvos,
  } = useFetch(endpoints.convos, fetchConfig);

  const {
    data: roomsRaw,
    loading: loadingRooms,
    error: errorRooms,
    retry: retryRooms,
  } = useFetch(endpoints.rooms, fetchConfig);

  // ✅ این ref کمک می‌کنه وقتی fetch موقتاً null شد، لیست‌ها پاک نشن
  const lastNonEmptyRef = useRef({ dms: null, groups: null });

  // --- normalize convos ---
  const dmPartners = useMemo(() => {
    if (!convos) return null; // 👈 مهم: null یعنی هنوز “جواب” نداریم، پس پاک نکن
    if (Array.isArray(convos.partners)) return convos.partners;
    if (Array.isArray(convos)) return convos;
    if (Array.isArray(convos.results)) return convos.results;
    if (Array.isArray(convos.data)) return convos.data;
    return [];
  }, [convos]);

  const groupFromConvos = useMemo(() => {
    if (!convos) return null; // 👈 مهم
    if (Array.isArray(convos.groups)) return convos.groups;
    return [];
  }, [convos]);

  // --- normalize rooms ---
  const normRooms = useMemo(() => {
    if (!roomsRaw) return null; // 👈 مهم
    return toArray(roomsRaw);
  }, [roomsRaw]);

  useEffect(() => {
    // ✅ DM ها: فقط وقتی جواب داریم dispatch کن
    if (dmPartners !== null) {
      if (Array.isArray(dmPartners) && dmPartners.length) lastNonEmptyRef.current.dms = dmPartners;
      dispatch(setIndividualMessages(dmPartners));
    } else if (lastNonEmptyRef.current.dms) {
      // optional: هیچ کاری نکن یا می‌تونی همین رو نگه داری
      // dispatch(setIndividualMessages(lastNonEmptyRef.current.dms));
    }

    // ✅ گروه‌ها: اولویت با convos.groups، fallback به rooms
    let groupsSource = null;

    if (groupFromConvos !== null && Array.isArray(groupFromConvos) && groupFromConvos.length) {
      groupsSource = groupFromConvos;
    } else if (normRooms !== null) {
      groupsSource = normRooms;
    }

    if (groupsSource !== null) {
      if (Array.isArray(groupsSource) && groupsSource.length) lastNonEmptyRef.current.groups = groupsSource;
      dispatch(setGroupMessages(groupsSource));
    } else if (lastNonEmptyRef.current.groups) {
      // optional نگه داشتن قبلی
      // dispatch(setGroupMessages(lastNonEmptyRef.current.groups));
    }

    dispatch(setLoading(Boolean(loadingConvos || loadingRooms)));

    const err = errorConvos || errorRooms;
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
    dmPartners,
    groupFromConvos,
    normRooms,
    loadingConvos,
    loadingRooms,
    errorConvos,
    errorRooms,
    dispatch,
  ]);

  return {
    retryRooms,
    retryUsers: undefined,
    retryConvos,
  };
}
