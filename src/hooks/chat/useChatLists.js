import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  selectIndividualMessages,
  selectGroupMessages,
  selectLoading,
  selectError,
  selectTypingIndicators,
} from '@/selectors/messageSelectors';

const normalizeDmList = (individualArray) => {
  const mapped = (individualArray || [])
    .map((item) => {
      const partnerId =
        item.partnerId || item.partner_id || item.user_id || item.id || null;

      const roomId =
        item.roomId ||
        item.room_id ||
        item.chat_room_id ||
        (item.room && item.room.id) ||
        null;

      if (!roomId || !partnerId) return null;

      return {
        ...item,
        partnerId,
        roomId,
        first_name: item.first_name || item.firstName || item.name || item.email || 'user',
        last_message: item.last_message || item.lastMessage || item.preview || '',
        last_message_at:
          item.last_message_at || item.lastMessageAt || item.updated_at || item.created_at || null,
      };
    })
    .filter(Boolean);

  return mapped.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
};

const filterDmByQuery = (list, q) => {
  const s = (q || '').toLowerCase();
  return list.filter((u) => (u.first_name || '').toLowerCase().includes(s));
};

const filterGroupsByQuery = (list, q) => {
  const s = (q || '').toLowerCase();
  return list.filter((r) => (r.name || '').toLowerCase().includes(s));
};

export function useChatLists({ searchQuery }) {
  const individualMap = useSelector(selectIndividualMessages);
  const groupMap = useSelector(selectGroupMessages);

  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const typingIndicators = useSelector(selectTypingIndicators);

  const individualArray = useMemo(() => Object.values(individualMap || {}), [individualMap]);
  const groupArray = useMemo(() => Object.values(groupMap || {}), [groupMap]);

  const dmList = useMemo(() => normalizeDmList(individualArray), [individualArray]);

  const filteredDm = useMemo(() => filterDmByQuery(dmList, searchQuery), [dmList, searchQuery]);
  const filteredGroups = useMemo(() => filterGroupsByQuery(groupArray, searchQuery), [groupArray, searchQuery]);

  return { dmList: filteredDm, groupList: filteredGroups, loading, error, typingIndicators };
}
