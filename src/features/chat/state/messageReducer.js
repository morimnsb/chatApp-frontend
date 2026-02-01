// src/reducers/messageReducer.js
import messageActionTypes from './messageActionTypes';

const initialState = {
  currentUser: {},
  users: {},

  individualMessages: {},
  groupMessages: {}, // ✅ ALL ROOMS MAP (private + group)

  selectedRoom: null,

  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },

  typingIndicators: {},
};

// ---------------- helpers ----------------
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const coerceId = (v) => (v == null ? null : Number(v) || String(v));

const roomIdFrom = (room) =>
  room?.id ?? room?.room_id ?? room?.roomId ?? room?.chat_room_id ?? null;

const msgRoomIdFrom = (msg) =>
  msg?.chat_room_id ?? msg?.room_id ?? msg?.roomId ?? msg?.room?.id ?? null;

const normalizeRoomsToMap = (payload) => {
  // payload may be: array of rooms OR map OR {rooms:[...]}
  const rooms =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rooms)
        ? payload.rooms
        : isObj(payload)
          ? payload
          : null;

  if (!rooms) return {};

  // if already a map of id->room
  if (!Array.isArray(rooms)) {
    const out = {};
    for (const [k, v] of Object.entries(rooms)) {
      if (!v) continue;
      const id = roomIdFrom(v) ?? k;
      if (id != null) out[String(id)] = v;
    }
    return out;
  }

  // array -> map
  const out = {};
  for (const r of rooms) {
    if (!r) continue;
    const id = roomIdFrom(r);
    if (id != null) out[String(id)] = r;
  }
  return out;
};

const msgIdFrom = (m) => m?.id ?? m?.message_id ?? null;

const pushDedupLimit = (arr, item, idKey, limit = 50) => {
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
export default function messageReducer(state = initialState, action) {
  switch (action.type) {
    case messageActionTypes.SET_CURRENT_USER: {
      return { ...state, currentUser: action.payload || {} };
    }

    case messageActionTypes.SET_USERS: {
      const usersArr = Array.isArray(action.payload) ? action.payload : [];
      const usersMap = {};
      for (const u of usersArr) {
        const id = u?.id ?? u?.user_id ?? null;
        if (id != null) usersMap[String(id)] = u;
      }
      return { ...state, users: usersMap };
    }

    // Conversations store (classic reducer)
    case messageActionTypes.SET_INDIVIDUAL_MESSAGES: {
      const payload = action.payload;
      // allow array or map
      const out = {};
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

    /**
     * ✅ CRITICAL:
     * groupMessages = ALL rooms map (private + group)
     */
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
      const conversationId = action.payload;
      // you sometimes pass receiverId, but unread_count belongs to room
      // keep as-is if you use it; otherwise no-op
      return state;
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

    /**
     * ✅ UPDATE_MESSAGES must upsert into groupMessages[roomId]
     * because ConversationList reads rooms from groupMessages
     */
    case messageActionTypes.UPDATE_MESSAGES: {
      const packet = action.payload || {};
      const msg = isObj(packet.message) ? packet.message : null;

      if (!msg) {
        return {
          ...state,
          errorStates: { ...state.errorStates, messages: 'Missing message in payload' },
        };
      }

      const roomId = coerceId(packet.room_id ?? packet.roomId ?? msgRoomIdFrom(msg));
      if (roomId == null) {
        return {
          ...state,
          errorStates: { ...state.errorStates, messages: 'Missing roomId in message payload' },
        };
      }

      const createdAt = msg?.created_at ?? msg?.timestamp ?? new Date().toISOString();

      const key = String(roomId);
      const prevRoom = state.groupMessages?.[key] || {};
      const mergedRoom = { ...prevRoom };

      mergedRoom.id = mergedRoom.id ?? roomId;
      // keep fields if server gave them
      if (packet.room && isObj(packet.room)) Object.assign(mergedRoom, packet.room);
      if (msg.room && isObj(msg.room)) Object.assign(mergedRoom, msg.room);

      mergedRoom.last_message = msg;
      mergedRoom.last_message_at = createdAt;

      // optional: keep small local messages list inside room object
      const mid = msgIdFrom(msg);
      mergedRoom.messages = pushDedupLimit(mergedRoom.messages, msg, mid, 50);

      const nextGroupMessages = {
        ...state.groupMessages,
        [key]: mergedRoom,
      };

      return {
        ...state,
        groupMessages: nextGroupMessages,
        errorStates: { ...state.errorStates, messages: null },
      };
    }

    default:
      return state;
  }
}

