// src/store/messageEntitySlice.js
import {
  createSlice,
  createEntityAdapter,
  nanoid,
  createSelector,
} from '@reduxjs/toolkit';

// ✅ آداپتر پیام‌ها (entity-based)
const messagesAdapter = createEntityAdapter({
  selectId: (msg) => msg.id,
  sortComparer: (a, b) => {
    // بر اساس زمان ایجاد مرتب می‌کنیم
    const ta = a.created_at || a.createdAt || '';
    const tb = b.created_at || b.createdAt || '';
    // اگر ISO string باشد، localeCompare جواب می‌دهد
    return ta.localeCompare(tb);
  },
});

// ✅ state اولیه + فیلدهای اضافه‌ی UI
const initialState = messagesAdapter.getInitialState({
  status: 'idle',
  error: null,
  selectedRoomId: null,
});

// ✅ اسلایس
const messageEntitySlice = createSlice({
  name: 'messagesEntity',
  initialState,
  reducers: {
    // انتخاب روم فعلی
    setSelectedRoom(state, action) {
      state.selectedRoomId = action.payload ?? null;
    },

    // اضافه کردن پیام لوکال (optimistic) با prepare + nanoid
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
            status: 'local', // بعداً سرور تأیید کرد → می‌تونی 'sent' کنی
          },
        };
      },
    },

    // upsert مجموعه‌ای از پیام‌ها (مثلاً برای یک روم از API گرفتی)
    upsertMessages(state, action) {
      const list = action.payload || [];
      // اگر payload فقط پیام‌های یک روم خاص است، می‌تونی قبلش clearRoomMessages را صدا بزنی
      messagesAdapter.upsertMany(state, list);
    },

    // جایگزین کردن کل پیام‌ها (مثلاً وقتی از server تمام state روم را می‌گیری)
    setMessages(state, action) {
      const list = action.payload || [];
      messagesAdapter.setAll(state, list);
    },

    // حذف یک پیام
    removeMessage(state, action) {
      messagesAdapter.removeOne(state, action.payload);
    },

    // پاک کردن پیام‌های یک روم خاص (نسخه بهینه‌تر با removeMany)
    clearRoomMessages(state, action) {
      const roomId = action.payload;
      const idsToRemove = Object.values(state.entities)
        .filter((m) => m && m.roomId === roomId)
        .map((m) => m.id);

      messagesAdapter.removeMany(state, idsToRemove);
    },

    // تنظیم وضعیت/خطا (آموزشی)
    setMessagesStatus(state, action) {
      state.status = action.payload || 'idle';
    },
    setMessagesError(state, action) {
      state.error = action.payload || null;
    },
  },
});

// اکشن‌ها
export const {
  setSelectedRoom,
  addLocalMessage,
  upsertMessages,
  setMessages,
  removeMessage,
  clearRoomMessages,
  setMessagesStatus,
  setMessagesError,
} = messageEntitySlice.actions;

// reducer
export default messageEntitySlice.reducer;

// ========= Selectors پایه =========

// state.root.messagesEntity
const selectMessagesEntityState = (state) => state.messagesEntity;

// ✅ selectors آماده‌ی adapter
export const messagesEntitySelectors = messagesAdapter.getSelectors(
  selectMessagesEntityState,
);

// فیلدهای کمکی
export const selectMessagesStatus = (state) =>
  selectMessagesEntityState(state).status;
export const selectMessagesError = (state) =>
  selectMessagesEntityState(state).error;
export const selectSelectedRoomId = (state) =>
  selectMessagesEntityState(state).selectedRoomId;

// ========= Selectors پیشرفته با createSelector =========

// ✅ همه‌ی پیام‌های یک روم (memoized)
export const selectMessagesByRoom = createSelector(
  [messagesEntitySelectors.selectAll, (_, roomId) => roomId],
  (allMessages, roomId) =>
    roomId ? allMessages.filter((m) => m.roomId === roomId) : [],
);

// ✅ پیام‌های روم فعلی
export const selectCurrentRoomMessages = createSelector(
  [messagesEntitySelectors.selectAll, selectSelectedRoomId],
  (allMessages, selectedRoomId) =>
    selectedRoomId
      ? allMessages.filter((m) => m.roomId === selectedRoomId)
      : [],
);

// ✅ آخرین پیام هر روم (برای سایدبار کانورسیشن)
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
        if (ta.localeCompare(tb) > 0) {
          map.set(msg.roomId, msg);
        }
      }
    }
    // خروجی به شکل object: { [roomId]: lastMessage }
    return Object.fromEntries(map.entries());
  },
);

// ✅ (آموزشی) تعداد پیام‌ها در روم فعلی
export const selectCurrentRoomCount = createSelector(
  [selectCurrentRoomMessages],
  (msgs) => msgs.length,
);
