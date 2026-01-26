// src/hooks/chat/useChatLists.js
import { useMemo, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  selectIndividualRaw,
  // ❌ selectGroupRaw (حذف شد)
  selectRoomsRaw,
  selectLoading,
  selectError,
  selectTypingIndicators,
  selectCurrentUserId,
  selectUsersByIdRaw,
} from '@/selectors/messageSelectors';

const DEV = import.meta.env.DEV === true;
const DEBUG_CHAT = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const EMPTY_OBJ = Object.freeze({});
const EMPTY_ARR = Object.freeze([]);

const isTruthy1 = (v) => v === true || v === 1 || v === '1';
const coerceId = (v) => (v == null ? null : Number(v) || String(v));

const pickPartnerIdFromIdsArray = (ids, currentUserId) => {
  if (!Array.isArray(ids) || !ids.length || !currentUserId) return null;
  const me = coerceId(currentUserId);
  return ids.map(coerceId).find((id) => id != null && id !== me) ?? null;
};

const normalizeDmList = (items) => {
  const mapped = (items || []).filter(Boolean).sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
  return mapped;
};

const filterByQuery = (list, q, key) => {
  const s = (q || '').toLowerCase().trim();
  if (!s) return list;
  return list.filter((x) => String(x?.[key] || '').toLowerCase().includes(s));
};

export function useChatLists({ searchQuery } = {}) {
  // ✅ اگر selectorها null دادند، ما اینجا ref ثابت می‌دیم
  const individualRaw = useSelector(selectIndividualRaw) ?? EMPTY_OBJ;
  const roomsRaw = useSelector(selectRoomsRaw) ?? EMPTY_OBJ;
  const usersById = useSelector(selectUsersByIdRaw) ?? EMPTY_OBJ;

  const currentUserId = useSelector(selectCurrentUserId);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const typingIndicators = useSelector(selectTypingIndicators) ?? EMPTY_OBJ;

  // -------------------------
  // ✅ DEBUG: detect rooms count change (2 -> 0 etc.)
  // -------------------------
  const prevRoomsCountRef = useRef(null);
  const prevRoomsSampleRef = useRef(EMPTY_ARR);

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const roomsArr = Object.values(roomsRaw || EMPTY_OBJ);
    const count = roomsArr.length;

    if (prevRoomsCountRef.current == null) {
      prevRoomsCountRef.current = count;
      prevRoomsSampleRef.current = roomsArr.slice(0, 2);
      console.log('[useChatLists][init] rooms snapshot', {
        count,
        currentUserId: currentUserId ?? null,
        sample: roomsArr.slice(0, 2),
      });
      return;
    }

    // اگر count تغییر کرد (خصوصاً رفت روی 0)
    if (count !== prevRoomsCountRef.current) {
      const before = prevRoomsCountRef.current;
      prevRoomsCountRef.current = count;

      console.warn('[useChatLists][rooms changed]', {
        before,
        after: count,
        currentUserId: currentUserId ?? null,
        sampleNow: roomsArr.slice(0, 3),
        sampleBefore: prevRoomsSampleRef.current,
      });

      // این خیلی کمک می‌کند بفهمی چه چیزی باعث شد rooms پاک شود
      console.trace('[useChatLists][rooms changed] trace');

      prevRoomsSampleRef.current = roomsArr.slice(0, 2);
    }
  }, [roomsRaw, currentUserId]);

  // ---- DM list ----
  const dmList = useMemo(() => {
    const out = [];

    // 1) اگر individualRaw (legacy) داریم
    const existingVals = Object.values(individualRaw || EMPTY_OBJ);
    if (existingVals.length) {
      for (const v of existingVals) {
        const roomId = coerceId(v?.roomId ?? v?.room_id ?? v?.chat_room_id ?? null);
        const partnerIdGuess = coerceId(
          v?.partnerId ?? v?.partner_id ?? v?.user_id ?? v?.id ?? null,
        );

        const room = roomId != null ? roomsRaw?.[String(roomId)] : null;
        const ids =
          Array.isArray(v?.users) ? v.users :
          Array.isArray(room?.users) ? room.users :
          null;

        const partnerId = partnerIdGuess ?? pickPartnerIdFromIdsArray(ids, currentUserId);

        if (!roomId || !partnerId) continue;

        const u = usersById?.[String(partnerId)] ?? null;

        out.push({
          ...v,
          roomId,
          partnerId,
          first_name: v?.first_name || u?.first_name || u?.name || u?.email || `User #${partnerId}`,
          last_message: v?.last_message ?? room?.last_message ?? v?.lastMessage ?? '',
          last_message_at:
            v?.last_message_at ??
            room?.last_message_at ??
            v?.updated_at ??
            v?.created_at ??
            null,
          photo: v?.photo || u?.photo || u?.profile_picture || null,
          // debug helpers (اختیاری)
          __src: 'individualRaw',
        });
      }
      return normalizeDmList(out);
    }

    // 2) fallback: از roomsRaw بساز (private ها)
    const rooms = Object.values(roomsRaw || EMPTY_OBJ);
    for (const r of rooms) {
      if (!isTruthy1(r?.is_private)) continue;

      const roomId = r?.id ?? null;
      const partnerId = pickPartnerIdFromIdsArray(r?.users, currentUserId);

      if (!roomId) continue;

      const u = partnerId ? (usersById?.[String(partnerId)] ?? null) : null;

      out.push({
        roomId,
        partnerId,
        first_name:
          u?.first_name ||
          u?.name ||
          u?.email ||
          (partnerId ? `User #${partnerId}` : 'Private Chat'),
        last_message: r?.last_message ?? '',
        last_message_at: r?.last_message_at ?? null,
        photo: u?.photo || u?.profile_picture || null,
        is_private: r?.is_private,
        __src: 'roomsRaw(private)',
      });
    }

    return normalizeDmList(out);
  }, [individualRaw, roomsRaw, usersById, currentUserId]);

  // ---- groups ----
  // ✅ groups را مستقیم از roomsRaw می‌سازیم (نه selectGroupRaw)
  const groupList = useMemo(() => {
    const vals = Object.values(roomsRaw || EMPTY_OBJ);
    return vals.filter((r) => !isTruthy1(r?.is_private));
  }, [roomsRaw]);

  const filteredDm = useMemo(
    () => filterByQuery(dmList, searchQuery, 'first_name'),
    [dmList, searchQuery],
  );

  const filteredGroups = useMemo(
    () => filterByQuery(groupList, searchQuery, 'name'),
    [groupList, searchQuery],
  );

  // ---- small, stable debug ----
  const prevSig = useRef('');
  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const sigObj = {
      roomsCount: Object.values(roomsRaw || EMPTY_OBJ).length,
      dmCount: filteredDm.length,
      groupCount: filteredGroups.length,
      currentUserId: currentUserId ?? null,
      loading: Boolean(loading),
      hasError: Boolean(error),
      hasUsersById: Object.keys(usersById || EMPTY_OBJ).length > 0,
    };

    const sig = JSON.stringify(sigObj);

    if (sig !== prevSig.current) {
      prevSig.current = sig;
      console.log('[useChatLists] snapshot', sigObj);
      console.log('[useChatLists] dm sample', filteredDm.slice(0, 2));
      console.log('[useChatLists] group sample', filteredGroups.slice(0, 2));
    }
  }, [roomsRaw, filteredDm, filteredGroups, currentUserId, loading, error, usersById]);

  return {
    dmList: filteredDm,
    groupList: filteredGroups,
    loading,
    error,
    typingIndicators,
  };
}
