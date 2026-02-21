//chatApp-frontend\src\features\chat\hooks\usePresenceMerge.ts
import { useMemo } from "react";

type Id = string | number;

export type PresenceUserLike =
  | Id
  | {
      id?: Id | null;
      user_id?: Id | null;
      user?: { id?: Id | null } | null;
      pivot?: { user_id?: Id | null } | null;
      [k: string]: any;
    };

export type ConnStateLike = any; // اگر ساختار دقیق داری می‌تونیم دقیقش کنیم

export type DmConvoLike = {
  partnerId?: Id | null;
  partner?: { id?: Id | null } | null;
  user_id?: Id | null;
  is_online?: boolean | null;
  [k: string]: any;
};

const toIdStr = (u: PresenceUserLike): string | null => {
  if (u == null) return null;

  // اگر خود id باشد
  if (typeof u === "string" || typeof u === "number") return String(u);

  const id = (u as any)?.id ?? (u as any)?.user_id ?? (u as any)?.user?.id ?? (u as any)?.pivot?.user_id;
  return id == null ? null : String(id);
};

type Args = {
  isNode?: boolean;
  onlineUsersNode?: PresenceUserLike[] | null;
  connStateNode?: ConnStateLike;
  onlineUsersReverb?: PresenceUserLike[] | null;
  connStateReverb?: ConnStateLike;
  dmList?: DmConvoLike[] | null;
};

export default function usePresenceMerge({
  isNode,
  onlineUsersNode,
  connStateNode,
  onlineUsersReverb,
  connStateReverb,
  dmList,
}: Args = {}) {
  const onlineUsers = isNode ? onlineUsersNode : onlineUsersReverb;
  const connState = isNode ? connStateNode : connStateReverb;

  const onlineIdSet = useMemo(() => {
    const set = new Set<string>();
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

      return { ...convo, is_online: Boolean(isOnlineNow) } as DmConvoLike;
    });
  }, [dmList, onlineIdSet]);

  return { onlineUsers, connState, onlineIdSet, dmListWithPresence } as const;
}