// src/hooks/chat/useChatLists.js
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[useChatLists]', ...a);

const safeArr = (v) => (Array.isArray(v) ? v : []);
const toNum = (v) => (v == null ? null : Number(v));

function toRoomArray(groupMessagesMap) {
  if (!groupMessagesMap) return [];
  if (Array.isArray(groupMessagesMap)) return groupMessagesMap;
  if (typeof groupMessagesMap === 'object') return Object.values(groupMessagesMap).filter(Boolean);
  return [];
}

function getLastAt(room) {
  return (
    room?.last_message_at ||
    room?.lastMessage?.created_at ||
    room?.last_message?.created_at ||
    room?.updated_at ||
    room?.created_at ||
    null
  );
}

export function useChatLists({ searchQuery = '', currentUserId = null } = {}) {
  const q = String(searchQuery || '').trim().toLowerCase();

  const roomsMap = useSelector((s) => s?.messages?.groupMessages);
  const typingIndicators = useSelector((s) => s?.messages?.typingIndicators) || {};
  const loading = useSelector((s) => Boolean(s?.messages?.loadingStates?.messages));
  const error = useSelector((s) => s?.messages?.errorStates?.messages) || null;

  const roomsAll = useMemo(() => {
    const arr = toRoomArray(roomsMap);

    const normalized = arr.map((r) => ({
      ...r,
      id: r?.id ?? r?.room_id ?? r?.roomId ?? r?.chat_room_id,
      is_private: Boolean(r?.is_private),
      last_message: r?.last_message ?? r?.lastMessage ?? null,
      last_message_at: r?.last_message_at ?? getLastAt(r),
    }));

    normalized.sort((a, b) => {
      const ta = new Date(getLastAt(a) || 0).getTime();
      const tb = new Date(getLastAt(b) || 0).getTime();
      return tb - ta;
    });

    return normalized;
  }, [roomsMap]);

  const { dmList, groupList } = useMemo(() => {
    const all = roomsAll;

    const filtered = !q
      ? all
      : all.filter((r) => {
          const name = String(r?.name || '').toLowerCase();
          const desc = String(r?.description || '').toLowerCase();
          const lastText = String(r?.last_message?.content || '').toLowerCase();
          return name.includes(q) || desc.includes(q) || lastText.includes(q);
        });

    const groups = filtered.filter((r) => r?.is_private === false);

    const dms = filtered
      .filter((r) => r?.is_private === true)
      .map((room) => {
        const users = safeArr(room?.users);

        const partner =
          currentUserId != null
            ? users.find((u) => toNum(u?.id) !== toNum(currentUserId)) || users[0] || null
            : users[0] || null;

        const partnerId = partner?.id ?? null;

        const lastMsgObj = room?.last_message ?? null;
        const lastMsgText =
          (typeof lastMsgObj === 'string' ? lastMsgObj : lastMsgObj?.content) ||
          room?.last_message_text ||
          '';

        return {
          roomId: room?.id,
          partnerId,
          partner,
          first_name: partner?.name ?? partner?.email ?? 'Unknown',
          email: partner?.email ?? null,

          is_private: true,
          users,
          last_message_obj: lastMsgObj,
          last_message_text: lastMsgText,
          last_message_at: room?.last_message_at ?? null,

          unread_count: room?.unread_count ?? 0,
        };
      });

    return { dmList: dms, groupList: groups };
  }, [roomsAll, q, currentUserId]);

  useMemo(() => {
    if (!DEBUG) return null;
    log('snapshot', {
      roomsCount: roomsAll.length,
      dmCount: dmList.length,
      groupCount: groupList.length,
      currentUserId,
      dmSample: dmList.slice(0, 2).map((x) => ({ roomId: x.roomId, partnerId: x.partnerId })),
      groupSample: groupList.slice(0, 2).map((x) => ({ id: x.id, name: x.name, is_private: x.is_private })),
    });
    return null;
  }, [roomsAll, dmList, groupList, currentUserId]);

  return { dmList, groupList, typingIndicators, loading, error };
}
