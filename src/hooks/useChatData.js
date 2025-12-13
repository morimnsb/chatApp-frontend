// src/hooks/useChatData.js
import { useEffect, useMemo } from 'react';
import useFetch from '@/hooks/useFetch';
import { useDispatch } from 'react-redux';
import {
  setLoading,
  setGroupMessages,
  setIndividualMessages,
  setError,
} from '@/actions/messageActions';
import { toErrorMessage } from '@/utils/errors';

export default function useChatData({ endpoints, accessToken }) {
  const dispatch = useDispatch();

  const fetchConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  // 🔹 لیست DM / partners (legacy + API جدید)
  const {
    data: convos,
    loading: loadingConvos,
    error: errorConvos,
    retry: retryConvos,
  } = useFetch(endpoints.convos, fetchConfig);

  // 🔹 لیست rooms (برای گروه‌ها یا بک‌اندهای قدیمی)
  const {
    data: roomsRaw,
    loading: loadingRooms,
    error: errorRooms,
    retry: retryRooms,
  } = useFetch(endpoints.rooms, fetchConfig);

  // --- نرمال‌سازی خروجی conversations ---
  const dmPartners = useMemo(() => {
    if (!convos) return [];

    // API جدید: { partners: [...] }
    if (Array.isArray(convos.partners)) return convos.partners;

    // بک‌اندهایی که مستقیم آرایه برمی‌گردونن
    if (Array.isArray(convos)) return convos;

    // فرم‌های دیگه: { results: [...] } یا { data: [...] }
    if (Array.isArray(convos.results)) return convos.results;
    if (Array.isArray(convos.data)) return convos.data;

    return [];
  }, [convos]);

  const groupFromConvos = useMemo(() => {
    if (!convos) return [];
    if (Array.isArray(convos.groups)) return convos.groups;
    return [];
  }, [convos]);

  // --- نرمال‌سازی rooms ---
  const normRooms = useMemo(() => {
    if (Array.isArray(roomsRaw)) return roomsRaw;
    if (Array.isArray(roomsRaw?.results)) return roomsRaw.results;
    if (Array.isArray(roomsRaw?.data)) return roomsRaw.data;
    return [];
  }, [roomsRaw]);

  // --- side effect: sync با Redux ---
  useEffect(() => {
    // ✅ DM ها (لیست گفتگوهای فردی)
    if (dmPartners) {
      dispatch(setIndividualMessages(dmPartners));
    }

    // ✅ گروه‌ها:
    // اگر API جدید groups دارد، از آن استفاده کن؛
    // وگرنه fallback به rooms قدیمی
    const groupsSource =
      groupFromConvos && groupFromConvos.length > 0
        ? groupFromConvos
        : normRooms;

    dispatch(setGroupMessages(groupsSource));

    // ✅ وضعیت loading کلی
    dispatch(setLoading(loadingConvos || loadingRooms));

    // ✅ وضعیت error کلی
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
    retryUsers: undefined, // برای سازگاری با HomeChat که retryRoomsUsers?.() صدا می‌زند
    retryConvos,
  };
}
