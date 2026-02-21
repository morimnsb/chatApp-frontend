// chatApp-frontend/src/hooks/chat/useChatLists.js
import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUserId } from '@/app/store/authSlice';

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
    room?.last_message?.createdAt ||
    room?.updated_at ||
    room?.updatedAt ||
    room?.created_at ||
    room?.createdAt ||
    null
  );
}

function safeTime(x) {
  const t = Date.parse(String(x || ''));
  return Number.isNaN(t) ? 0 : t;
}

function normalizeKind(r) {
  const k = String(r?.kind ?? r?.type ?? '').toLowerCase();

  if (k === 'dm' || k === 'direct' || k === 'private') return 'dm';
  if (k === 'group' || k === 'grp' || k === 'public') return 'group';

  if (r?.isGroup === true || r?.is_group === true) return 'group';
  if (r?.isGroup === false || r?.is_group === false) return 'dm';

  if (r?.is_private === true) return 'dm';
  if (r?.is_private === false) return 'group';

  return null;
}

// ✅ always return [{id,name,email}] user objects
function normalizeUsers(r) {
  // 1) members: [{user:{...}}]
  if (Array.isArray(r?.members)) {
    return r.members
      .map((m) => m?.user ?? m)
      .filter((u) => u && u.id != null);
  }

  // 2) users: [{id,...}] (Laravel conversations)
  if (Array.isArray(r?.users)) {
    return r.users
      .map((u) => u?.user ?? u)
      .filter((u) => u && u.id != null);
  }

  if (Array.isArray(r?.participants)) {
    return r.participants
      .map((u) => u?.user ?? u)
      .filter((u) => u && u.id != null);
  }

  return [];
}

function normalizeLastText(r) {
  const lm =
    r?.last_message_obj ??
    r?.last_message ??
    r?.lastMessage ??
    r?.last_msg ??
    null;

  if (typeof lm === 'string') return lm;

  return (
    lm?.content ??
    lm?.text ??
    r?.last_message_text ??
    ''
  );
}

export function useChatLists({ searchQuery = '', currentUserId: currentUserIdProp = null } = {}) {
  const q = String(searchQuery || '').trim().toLowerCase();

  const roomsMap = useSelector((s) => s?.messages?.groupMessages);
  const typingIndicators = useSelector((s) => s?.messages?.typingIndicators) || {};
  const loading = useSelector((s) => Boolean(s?.messages?.loadingStates?.messages));
  const error = useSelector((s) => s?.messages?.errorStates?.messages) || null;

  // ✅ source of truth from redux (can be overridden by prop if provided)
  const currentUserIdRedux = useSelector(selectCurrentUserId);
  const currentUserId = currentUserIdProp ?? currentUserIdRedux ?? null;

  const roomsAll = useMemo(() => {
    const arr = toRoomArray(roomsMap);

    const normalized = arr
      .map((r) => {
        const id = r?.id ?? r?.room_id ?? r?.roomId ?? r?.chat_room_id ?? null;
        const kind = normalizeKind(r) || 'group';
        const users = normalizeUsers(r);

        return {
          ...r,
          id,
          kind,
          is_private: kind === 'dm',
          users,
          last_message: r?.last_message ?? r?.lastMessage ?? r?.last_message_obj ?? null,
          last_message_at: r?.last_message_at ?? getLastAt(r),
          name:
            r?.name ??
            r?.title ??
            r?.display_name ??
            r?.room_name ??
            r?.roomTitle ??
            null,
        };
      })
      .filter((r) => r?.id != null);

    normalized.sort((a, b) => safeTime(getLastAt(b)) - safeTime(getLastAt(a)));
    return normalized;
  }, [roomsMap]);

  const { dmList, groupList } = useMemo(() => {
    const all = roomsAll;

    const filtered = !q
      ? all
      : all.filter((r) => {
          const name = String(r?.name || '').toLowerCase();
          const desc = String(r?.description || '').toLowerCase();
          const lastText = String(normalizeLastText(r) || '').toLowerCase();

          const partnerNames = safeArr(r?.users)
            .map((u) => String(u?.name || u?.email || '').toLowerCase())
            .join(' ');

          return (
            name.includes(q) ||
            desc.includes(q) ||
            lastText.includes(q) ||
            partnerNames.includes(q)
          );
        });

    const groups = filtered.filter((r) => r?.kind === 'group');

    const dms = filtered
      .filter((r) => r?.kind === 'dm')
      .map((room) => {
        const users = safeArr(room?.users);

        const partner =
          currentUserId != null
            ? users.find((u) => toNum(u?.id) !== toNum(currentUserId)) || users[0] || null
            : users[0] || null;

        const partnerId = partner?.id ?? null;

        const lastMsgObj =
          room?.last_message_obj ??
          room?.last_message ??
          null;

        const lastMsgText =
          (typeof lastMsgObj === 'string'
            ? lastMsgObj
            : lastMsgObj?.content ?? lastMsgObj?.text) ||
          room?.last_message_text ||
          '';

        return {
          roomId: room?.id,
          partnerId,
          partner,
          first_name: partner?.name ?? partner?.email ?? 'Unknown',
          email: partner?.email ?? null,

          kind: 'dm',
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

  useEffect(() => {
    if (!DEBUG) return;

    log('snapshot', {
      roomsCount: roomsAll.length,
      dmCount: dmList.length,
      groupCount: groupList.length,
      currentUserId,
      currentUserIdRedux,
      dmSample: dmList.slice(0, 2).map((x) => ({ roomId: x.roomId, partnerId: x.partnerId })),
      groupSample: groupList.slice(0, 2).map((x) => ({ id: x.id, name: x.name, kind: x.kind })),
    });
  }, [roomsAll, dmList, groupList, currentUserId, currentUserIdRedux]);

  return { dmList, groupList, typingIndicators, loading, error };
}