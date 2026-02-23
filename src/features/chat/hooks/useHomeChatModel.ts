// chatApp-frontend/src/features/chat/hooks/useHomeChatModel.ts
import type React from "react";
import { buildEndpoints, useBackendChoice } from "@/shared/backend";
import { useAuthBasics } from "@/features/auth/hooks/useAuthBasics";
import { useRealtimeBus } from "@/features/chat/providers/ChatRealtimeProvider";
import { useGlobalNotify } from "@/features/chat/hooks/useGlobalNotify";
import useRealtimeRouter from "@/features/chat/hooks/useRealtimeRouter";
import useRoomResetOnBackendChange from "@/features/chat/hooks/useRoomResetOnBackendChange";

import useChatData from "@/features/chat/hooks/useChatData";
import { useChatLists } from "@/features/chat/hooks/useChatLists";
import { useUsersQuery } from "@/features/chat/hooks/useUsersQuery";

import { usePresence } from "@/features/chat/hooks/usePresence";
import useReverbConnState from "@/features/chat/hooks/useReverbConnState";
import useNodeSocket from "@/features/chat/hooks/useNodeSocket";
import usePresenceMerge from "@/features/chat/hooks/usePresenceMerge";
import useTypingSender from "@/features/chat/hooks/useTypingSender";

import type { HomeChatModel, RoomId } from "@/features/chat/types/homeChat";
import toUiBackendKind from "@/features/chat/utils/toUiBackendKind";

type Params = {
  q: string;
  rid: RoomId | null;
  setRid: React.Dispatch<React.SetStateAction<RoomId | null>>;
};

export function useHomeChatModel({ q, rid, setRid }: Params): HomeChatModel {
  const { effectiveKind: k } = useBackendChoice();
const uiK = toUiBackendKind(k);

  const rt = useRealtimeBus();
  const { bareToken: t, currentUser: me, currentUserId: uid } = useAuthBasics();

  const nfy = useGlobalNotify({ selectedRoom: rid });

  const { registerIncoming: reg } = useRealtimeRouter({
  effectiveKind: k,
  selectedRoomId: rid,
  currentUserId: uid ?? null,
  onGlobalNotif: nfy,
  realtime: rt,
  bareToken: t, // ✅ add
});

  useRoomResetOnBackendChange({ effectiveKind: k, bareToken: t, setRoomId: setRid });

  const L = useChatLists({ searchQuery: q, currentUserId: uid });

  const { retryRooms, retryConvos } = useChatData({
    endpoints: buildEndpoints(k),
    accessToken: t,
  });

  const U = useUsersQuery({ bareToken: t, searchQuery: q, retryRooms });

  const { onlineUsers: onlineReverb } = usePresence({
    backendKind: k,
    token: t,
    currentUserId: uid,
  });

  const connReverb = useReverbConnState({ backendKind: k, token: t });

  const N = useNodeSocket({ effectiveKind: k, selectedRoomId: rid, onNotify: nfy });

  const M = usePresenceMerge({
    isNode: N.isNode,
    onlineUsersNode: N.onlineUsers ?? undefined,
    connStateNode: N.connState,
    onlineUsersReverb: onlineReverb ?? undefined,
    connStateReverb: connReverb,
    dmList: L.dmList ?? undefined,
  });

  const sendTyping = useTypingSender({
  effectiveKind: k,
  bareToken: t,
  currentUserId: uid ?? null,
});

  const retryAll = () => {
    retryRooms?.();
    retryConvos?.();
    U.usersQ?.refetch?.();
  };

  return {
    sidebar: {
      k: uiK, 
      me: (me as any) ?? null,
      rid,
      setRid,
      retryAll,
      lists: {
        dmListWithPresence: (M.dmListWithPresence as any) ?? [],
        groupList: (L.groupList as any) ?? [],
        typingIndicators: (L.typingIndicators as any) ?? {},
        onlineUsers: (M.onlineUsers as any) ?? [],
        loading: (L.loading as any) ?? false,
        error: (L.error as any) ?? null,
      },
      users: {
        usersQ: (U.usersQ as any) ?? undefined,
        filteredUsers: (U.filteredUsers as any) ?? [],
        handleFriendshipRequest: (U.handleFriendshipRequest as any) ?? (() => {}),
        handleRespondFriendRequest: (U.handleRespondFriendRequest as any) ?? (() => {}),
      },
    },

    chat: {
  k: String(k ?? ""),
  t: (t as any) ?? null,
  rid,
  registerIncoming: reg as any, // ✅ fix
  sendTyping: sendTyping as any,
},
  };
}