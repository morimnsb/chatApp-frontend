// chatApp-frontend\src\features\chat\state\messageReducer.ts
import messageActionTypes from "./messageActionTypes";

type Id = number | string;

export type MessageLike = {
  id?: Id | null;
  message_id?: Id | null;
  chat_room_id?: Id | null;
  room_id?: Id | null;
  roomId?: Id | null;
  created_at?: string | null;
  timestamp?: string | null;
  room?: any;
  [k: string]: any;
};

export type RoomLike = {
  id?: Id | null;
  room_id?: Id | null;
  roomId?: Id | null;
  chat_room_id?: Id | null;
  last_message?: MessageLike | null;
  last_message_at?: string | null;
  messages?: MessageLike[];
  [k: string]: any;
};

export type TypingIndicators = Record<string, boolean>;

export type MessageState = {
  currentUser: Record<string, any>;
  users: Record<string, any>;

  individualMessages: Record<string, any>;
  groupMessages: Record<string, RoomLike>;

  selectedRoom: any | null;

  loadingStates: { users: boolean; messages: boolean };
  errorStates: { users: string | null; messages: string | null };

  typingIndicators: TypingIndicators;
};

type AnyAction = { type: string; payload?: any };

const initialState: MessageState = {
  currentUser: {},
  users: {},

  individualMessages: {},
  groupMessages: {},

  selectedRoom: null,

  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },

  typingIndicators: {},
};

// ---------------- helpers ----------------
const isObj = (v: unknown): v is Record<string, any> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const coerceId = (v: unknown): Id | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n;
};

const roomIdFrom = (room: any): Id | null =>
  room?.id ?? room?.room_id ?? room?.roomId ?? room?.chat_room_id ?? null;

const msgRoomIdFrom = (msg: any): Id | null =>
  msg?.chat_room_id ?? msg?.room_id ?? msg?.roomId ?? msg?.room?.id ?? null;

const normalizeRoomsToMap = (payload: any): Record<string, RoomLike> => {
  const rooms =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rooms)
        ? payload.rooms
        : isObj(payload)
          ? payload
          : null;

  if (!rooms) return {};

  // already map
  if (!Array.isArray(rooms)) {
    const out: Record<string, RoomLike> = {};
    for (const [k, v] of Object.entries(rooms)) {
      if (!v) continue;
      const id = roomIdFrom(v) ?? k;
      if (id != null) out[String(id)] = v as RoomLike;
    }
    return out;
  }

  // array -> map
  const out: Record<string, RoomLike> = {};
  for (const r of rooms) {
    if (!r) continue;
    const id = roomIdFrom(r);
    if (id != null) out[String(id)] = r as RoomLike;
  }
  return out;
};

const msgIdFrom = (m: any): Id | null => m?.id ?? m?.message_id ?? null;

const pushDedupLimit = (
  arr: MessageLike[] | undefined,
  item: MessageLike,
  idKey: Id | null,
  limit = 50
): MessageLike[] => {
  if (!Array.isArray(arr)) return [item];
  const id = idKey;
  if (id != null) {
    if (arr.some((x) => String(msgIdFrom(x)) === String(id))) return arr;
  }
  const next = [...arr, item];
  if (next.length > limit) return next.slice(next.length - limit);
  return next;
};

// -------------- reducer --------------
export default function messageReducer(
  state: MessageState = initialState,
  action: AnyAction
): MessageState {
  switch (action.type) {
    case messageActionTypes.SET_CURRENT_USER: {
      return { ...state, currentUser: action.payload || {} };
    }

    case messageActionTypes.SET_USERS: {
      const usersArr = Array.isArray(action.payload) ? action.payload : [];
      const usersMap: Record<string, any> = {};
      for (const u of usersArr) {
        const id = u?.id ?? u?.user_id ?? null;
        if (id != null) usersMap[String(id)] = u;
      }
      return { ...state, users: usersMap };
    }

    case messageActionTypes.SET_INDIVIDUAL_MESSAGES: {
      const payload = action.payload;
      const out: Record<string, any> = {};

      if (Array.isArray(payload)) {
        for (const c of payload) {
          const pid = c?.partnerId ?? c?.partner_id ?? c?.user_id ?? c?.id ?? null;
          if (pid != null) out[String(pid)] = c;
        }
      } else if (isObj(payload)) {
        Object.assign(out, payload);
      }

      return { ...state, individualMessages: out };
    }

    case messageActionTypes.SET_GROUP_MESSAGES: {
      const incomingMap = normalizeRoomsToMap(action.payload);
      return {
        ...state,
        groupMessages: incomingMap,
        errorStates: { ...state.errorStates, messages: null },
      };
    }

    case messageActionTypes.SELECT_ROOM: {
      return { ...state, selectedRoom: action.payload ?? null };
    }

    case messageActionTypes.CLEAR_UNREAD_COUNT: {
      return state; // keep as-is
    }

    case messageActionTypes.SET_TYPING_INDICATOR: {
      const p = action.payload || {};
      const userId = p.userId ?? p.user_id ?? null;
      if (userId == null) return state;

      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [String(userId)]: Boolean(p.isTyping ?? p.typing ?? true),
        },
      };
    }

    case messageActionTypes.RESET_TYPING_INDICATOR: {
      const p = action.payload || {};
      const userId = p.userId ?? p.user_id ?? p;
      if (userId == null) return state;

      const next = { ...state.typingIndicators };
      delete next[String(userId)];
      return { ...state, typingIndicators: next };
    }

    case messageActionTypes.UPDATE_MESSAGES: {
  const packet = action.payload || {};

  const msgCandidate =
    (isObj(packet.message) && packet.message) ||
    (isObj(packet.data?.message) && packet.data.message) ||
    (isObj(packet) && (packet as any));

  const msg = isObj(msgCandidate) ? (msgCandidate as MessageLike) : null;

  if (!msg) {
    return {
      ...state,
      errorStates: { ...state.errorStates, messages: "Missing message in payload" },
    };
  }

  const roomId = coerceId(packet.room_id ?? packet.roomId ?? msgRoomIdFrom(msg));
  if (roomId == null) {
    return {
      ...state,
      errorStates: { ...state.errorStates, messages: "Missing roomId in message payload" },
    };
  }

  const createdAt = msg?.created_at ?? msg?.timestamp ?? new Date().toISOString();

  const key = String(roomId);
  const prevRoom = (state.groupMessages?.[key] || {}) as RoomLike;
  const mergedRoom: RoomLike = { ...prevRoom };

  mergedRoom.id = mergedRoom.id ?? roomId;

  if (packet.room && isObj(packet.room)) Object.assign(mergedRoom, packet.room);
  if ((msg as any).room && isObj((msg as any).room)) Object.assign(mergedRoom, (msg as any).room);

  mergedRoom.last_message = msg;
  mergedRoom.last_message_at = createdAt;

  const mid = msgIdFrom(msg);
  mergedRoom.messages = pushDedupLimit(mergedRoom.messages, msg, mid, 50);

  return {
    ...state,
    groupMessages: {
      ...state.groupMessages,
      [key]: mergedRoom,
    },
    errorStates: { ...state.errorStates, messages: null },
  };
}

    default:
      return state;
  }
}