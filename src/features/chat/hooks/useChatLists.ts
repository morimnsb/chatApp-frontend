import { useEffect, useMemo } from "react";
import { useAppSelector } from "@/app/store/hooks";
import { selectCurrentUserId } from "@/app/store/authSlice";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[useChatLists]", ...a);

type Id = string | number;

type UserLike = {
  id?: Id | null;
  name?: string | null;
  email?: string | null;
  user?: UserLike;
  [k: string]: any;
};

export type RoomLike = {
  id?: Id | null;
  room_id?: Id | null;
  roomId?: Id | null;
  chat_room_id?: Id | null;

  kind?: string | null;
  type?: string | null;

  name?: string | null;
  title?: string | null;
  display_name?: string | null;
  room_name?: string | null;
  roomTitle?: string | null;

  description?: string | null;

  isGroup?: boolean | null;
  is_group?: boolean | null;
  is_private?: boolean | null;

  updated_at?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  createdAt?: string | null;

  last_message_at?: string | null;
  lastMessage?: any;
  last_message?: any;
  last_message_obj?: any;
  last_msg?: any;
  last_message_text?: string | null;

  unread_count?: number | null;

  members?: any[] | null; // [{user:{...}}]
  users?: any[] | null;   // [{id,...}] or [{user:{...}}]
  participants?: any[] | null;

  [k: string]: any;
};

export type NormalizedRoom = RoomLike & {
  id: Id;
  kind: "dm" | "group";
  users: UserLike[];
  is_private: boolean;
  last_message: any;
  last_message_at: string | null;
  name: string | null;
};

export type DmItem = {
  roomId: Id;
  partnerId: Id | null;
  partner: UserLike | null;

  first_name: string;
  email: string | null;

  kind: "dm";
  is_private: true;

  users: UserLike[];

  last_message_obj: any;
  last_message_text: string;
  last_message_at: string | null;

  unread_count: number;
};

export type UseChatListsResult = {
  dmList: DmItem[];
  groupList: NormalizedRoom[];
  typingIndicators: Record<string, boolean>;
  loading: boolean;
  error: string | null;
};

const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

function toRoomArray(groupMessagesMap: unknown): RoomLike[] {
  if (!groupMessagesMap) return [];
  if (Array.isArray(groupMessagesMap)) return groupMessagesMap as RoomLike[];
  if (typeof groupMessagesMap === "object") {
    return Object.values(groupMessagesMap as Record<string, any>).filter(Boolean) as RoomLike[];
  }
  return [];
}

function getLastAt(room: any): string | null {
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

function safeTime(x: unknown): number {
  const t = Date.parse(String(x || ""));
  return Number.isNaN(t) ? 0 : t;
}

function normalizeKind(r: any): "dm" | "group" | null {
  const k = String(r?.kind ?? r?.type ?? "").toLowerCase();

  if (k === "dm" || k === "direct" || k === "private") return "dm";
  if (k === "group" || k === "grp" || k === "public") return "group";

  if (r?.isGroup === true || r?.is_group === true) return "group";
  if (r?.isGroup === false || r?.is_group === false) return "dm";

  if (r?.is_private === true) return "dm";
  if (r?.is_private === false) return "group";

  return null;
}

// ✅ always return [{id,name,email}] user objects
function normalizeUsers(r: any): UserLike[] {
  // 1) members: [{user:{...}}]
  if (Array.isArray(r?.members)) {
    return r.members
      .map((m: any) => m?.user ?? m)
      .filter((u: any) => u && u.id != null);
  }

  // 2) users: [{id,...}] (Laravel conversations)
  if (Array.isArray(r?.users)) {
    return r.users
      .map((u: any) => u?.user ?? u)
      .filter((u: any) => u && u.id != null);
  }

  if (Array.isArray(r?.participants)) {
    return r.participants
      .map((u: any) => u?.user ?? u)
      .filter((u: any) => u && u.id != null);
  }

  return [];
}

function normalizeLastText(r: any): string {
  const lm = r?.last_message_obj ?? r?.last_message ?? r?.lastMessage ?? r?.last_msg ?? null;
  if (typeof lm === "string") return lm;

  return (lm?.content ?? lm?.text ?? r?.last_message_text ?? "") as string;
}

export function useChatLists(
  {
    searchQuery = "",
    currentUserId: currentUserIdProp = null,
  }: { searchQuery?: string; currentUserId?: Id | null } = {}
): UseChatListsResult {
  const q = String(searchQuery || "").trim().toLowerCase();

  const roomsMap = useAppSelector((s) => (s as any)?.messages?.groupMessages);
  const typingIndicators =
    useAppSelector((s) => (s as any)?.messages?.typingIndicators) || {};
  const loading = useAppSelector((s) => Boolean((s as any)?.messages?.loadingStates?.messages));
  const error = useAppSelector((s) => (s as any)?.messages?.errorStates?.messages) || null;

  // ✅ source of truth from redux (can be overridden by prop if provided)
  const currentUserIdRedux = useAppSelector(selectCurrentUserId);
  const currentUserId = (currentUserIdProp ?? currentUserIdRedux ?? null) as Id | null;

  const roomsAll = useMemo<NormalizedRoom[]>(() => {
    const arr = toRoomArray(roomsMap);

    const normalized = arr
      .map((r) => {
        const id = (r?.id ?? r?.room_id ?? r?.roomId ?? r?.chat_room_id ?? null) as Id | null;
        const kind = normalizeKind(r) || "group";
        const users = normalizeUsers(r);

        return {
          ...(r as any),
          id,
          kind,
          is_private: kind === "dm",
          users,
          last_message: r?.last_message ?? r?.lastMessage ?? r?.last_message_obj ?? null,
          last_message_at: (r?.last_message_at ?? getLastAt(r)) as string | null,
          name:
            (r?.name ??
              r?.title ??
              r?.display_name ??
              r?.room_name ??
              r?.roomTitle ??
              null) as string | null,
        };
      })
      .filter((r): r is NormalizedRoom => r?.id != null);

    normalized.sort((a, b) => safeTime(getLastAt(b)) - safeTime(getLastAt(a)));
    return normalized;
  }, [roomsMap]);

  const { dmList, groupList } = useMemo((): { dmList: DmItem[]; groupList: NormalizedRoom[] } => {
    const all = roomsAll;

    const filtered = !q
      ? all
      : all.filter((r) => {
          const name = String(r?.name || "").toLowerCase();
          const desc = String((r as any)?.description || "").toLowerCase();
          const lastText = String(normalizeLastText(r) || "").toLowerCase();

          const partnerNames = safeArr<UserLike>(r?.users)
            .map((u) => String(u?.name || u?.email || "").toLowerCase())
            .join(" ");

          return (
            name.includes(q) ||
            desc.includes(q) ||
            lastText.includes(q) ||
            partnerNames.includes(q)
          );
        });

    const groups = filtered.filter((r) => r?.kind === "group");

    const dms = filtered
      .filter((r) => r?.kind === "dm")
      .map((room) => {
        const users = safeArr<UserLike>(room?.users);

        const partner =
          currentUserId != null
            ? users.find((u) => toNum(u?.id) !== toNum(currentUserId)) || users[0] || null
            : users[0] || null;

        const partnerId = (partner?.id ?? null) as Id | null;

        const lastMsgObj = (room as any)?.last_message_obj ?? (room as any)?.last_message ?? null;

        const lastMsgText =
          (typeof lastMsgObj === "string" ? lastMsgObj : lastMsgObj?.content ?? lastMsgObj?.text) ||
          (room as any)?.last_message_text ||
          "";

        return {
          roomId: room.id,
          partnerId,
          partner,
          first_name: (partner?.name ?? partner?.email ?? "Unknown") as string,
          email: (partner?.email ?? null) as string | null,

          kind: "dm",
          is_private: true as const,
          users,

          last_message_obj: lastMsgObj,
          last_message_text: String(lastMsgText),
          last_message_at: room?.last_message_at ?? null,

          unread_count: Number((room as any)?.unread_count ?? 0),
        } satisfies DmItem;
      });

    return { dmList: dms, groupList: groups };
  }, [roomsAll, q, currentUserId]);

  useEffect(() => {
    if (!DEBUG) return;

    log("snapshot", {
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