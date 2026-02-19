// chatApp-frontend/src/features/chat/hooks/usePresenceMerge.js
import { useMemo } from 'react';

const toIdStr = (u) => {
  const id = u?.id ?? u?.user_id ?? u?.user?.id ?? u?.pivot?.user_id ?? u;
  return id == null ? null : String(id);
};

/**
 * usePresenceMerge
 * - unified onlineUsers + connState for node/reverb
 * - adds is_online to dmList based on presence (without bloating HomeChat)
 */
export default function usePresenceMerge({
  isNode,
  onlineUsersNode,
  connStateNode,
  onlineUsersReverb,
  connStateReverb,
  dmList,
} = {}) {
  const onlineUsers = isNode ? onlineUsersNode : onlineUsersReverb;
  const connState = isNode ? connStateNode : connStateReverb;

  const onlineIdSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(onlineUsers) ? onlineUsers : []).forEach((u) => {
      const s = toIdStr(u);
      if (s) set.add(s);
    });
    return set;
  }, [onlineUsers]);

  const dmListWithPresence = useMemo(() => {
    const list = Array.isArray(dmList) ? dmList : [];

    return list.map((convo) => {
      const pid = convo?.partnerId ?? convo?.partner?.id ?? convo?.user_id ?? null;

      // اگر presence نداریم، مقدار قبلی را نگه دار
      const hasPresence = onlineIdSet.size > 0;
      const isOnlineNow =
        hasPresence && pid != null ? onlineIdSet.has(String(pid)) : convo?.is_online;

      return { ...convo, is_online: Boolean(isOnlineNow) };
    });
  }, [dmList, onlineIdSet]);

  return { onlineUsers, connState, onlineIdSet, dmListWithPresence };
}
