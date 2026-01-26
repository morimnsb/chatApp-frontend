// src/store/messageEntitySlice.js
import {
  createSlice,
  createEntityAdapter,
  nanoid,
  createSelector,
} from '@reduxjs/toolkit';

const EMPTY_ARR = [];
const EMPTY_OBJ = {};

// ✅ آداپتر پیام‌ها (entity-based)
const messagesAdapter = createEntityAdapter({
  selectId: (msg) => msg.id,
  sortComparer: (a, b) => {
    const ta = a.created_at || a.createdAt || '';
    const tb = b.created_at || b.createdAt || '';
    return String(ta).localeCompare(String(tb));
  },
});

// ✅ state اولیه + فیلدهای اضافه‌ی UI + roomsRaw
const initialState = messagesAdapter.getInitialState({
  status: 'idle',
  error: null,
  selectedRoomId: null,

  // ✅ NEW: لیست خام rooms از API (برای ساخت DM/Group list)
  roomsRaw: EMPTY_ARR,
  roomsStatus: 'idle',
  roomsError: null,
});

const messageEntitySlice = createSlice({
  name: 'messagesEntity',
  initialState,
  reducers: {
    // انتخاب روم فعلی
    setSelectedRoom(state, action) {
      state.selectedRoomId = action.payload ?? null;
    },

    // ✅ NEW: set roomsRaw
    setRoomsRaw(state, action) {
      const arr = Array.isArray(action.payload) ? action.payload : EMPTY_ARR;
      state.roomsRaw = arr;
      state.roomsStatus = 'succeeded';
      state.roomsError = null;
    },
    clearRoomsRaw(state) {
      state.roomsRaw = EMPTY_ARR;
      state.roomsStatus = 'idle';
      state.roomsError = null;
    },
    setRoomsStatus(state, action) {
      state.roomsStatus = action.payload || 'idle';
    },
    setRoomsError(state, action) {
      state.roomsError = action.payload || null;
    },

    // اضافه کردن پیام لوکال (optimistic)
    addLocalMessage: {
      reducer(state, action) {
        messagesAdapter.addOne(state, action.payload);
      },
      prepare({ roomId, userId, content }) {
        return {
          payload: {
            id: nanoid(),
            roomId,
            userId,
            content,
            created_at: new Date().toISOString(),
            status: 'local',
          },
        };
      },
    },

    upsertMessages(state, action) {
      const list = Array.isArray(action.payload) ? action.payload : EMPTY_ARR;
      messagesAdapter.upsertMany(state, list);
    },

    setMessages(state, action) {
      const list = Array.isArray(action.payload) ? action.payload : EMPTY_ARR;
      messagesAdapter.setAll(state, list);
    },

    removeMessage(state, action) {
      messagesAdapter.removeOne(state, action.payload);
    },

    clearRoomMessages(state, action) {
      const roomId = action.payload;
      if (!roomId) return;

      const idsToRemove = Object.values(state.entities)
        .filter((m) => m && m.roomId === roomId)
        .map((m) => m.id);

      messagesAdapter.removeMany(state, idsToRemove);
    },

    setMessagesStatus(state, action) {
      state.status = action.payload || 'idle';
    },
    setMessagesError(state, action) {
      state.error = action.payload || null;
    },
  },
});

export const {
  setSelectedRoom,
  setRoomsRaw,
  clearRoomsRaw,
  setRoomsStatus,
  setRoomsError,

  addLocalMessage,
  upsertMessages,
  setMessages,
  removeMessage,
  clearRoomMessages,
  setMessagesStatus,
  setMessagesError,
} = messageEntitySlice.actions;

export default messageEntitySlice.reducer;

// ========= Selectors پایه =========

const selectMessagesEntityState = (state) => state.messagesEntity || EMPTY_OBJ;

export const messagesEntitySelectors = messagesAdapter.getSelectors(
  selectMessagesEntityState,
);

export const selectMessagesStatus = (state) => selectMessagesEntityState(state).status;
export const selectMessagesError = (state) => selectMessagesEntityState(state).error;
export const selectSelectedRoomId = (state) => selectMessagesEntityState(state).selectedRoomId;

// ✅ NEW: roomsRaw selectors
export const selectRoomsRaw = (state) => selectMessagesEntityState(state).roomsRaw || EMPTY_ARR;
export const selectRoomsStatus = (state) => selectMessagesEntityState(state).roomsStatus;
export const selectRoomsError = (state) => selectMessagesEntityState(state).roomsError;

// ========= Selectors پیشرفته =========

export const selectMessagesByRoom = createSelector(
  [messagesEntitySelectors.selectAll, (_, roomId) => roomId],
  (allMessages, roomId) => (roomId ? allMessages.filter((m) => m.roomId === roomId) : EMPTY_ARR),
);

export const selectCurrentRoomMessages = createSelector(
  [messagesEntitySelectors.selectAll, selectSelectedRoomId],
  (allMessages, selectedRoomId) =>
    selectedRoomId ? allMessages.filter((m) => m.roomId === selectedRoomId) : EMPTY_ARR,
);

export const selectLastMessageByRoom = createSelector(
  [messagesEntitySelectors.selectAll],
  (allMessages) => {
    const map = new Map();
    for (const msg of allMessages) {
      const prev = map.get(msg.roomId);
      if (!prev) {
        map.set(msg.roomId, msg);
      } else {
        const ta = msg.created_at || msg.createdAt || '';
        const tb = prev.created_at || prev.createdAt || '';
        if (String(ta).localeCompare(String(tb)) > 0) {
          map.set(msg.roomId, msg);
        }
      }
    }
    return Object.fromEntries(map.entries());
  },
);

export const selectCurrentRoomCount = createSelector(
  [selectCurrentRoomMessages],
  (msgs) => msgs.length,
);
