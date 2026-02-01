// src/store/messageSlice.js
import {
  createSlice,
  createEntityAdapter,
  nanoid,
  createSelector,
} from '@reduxjs/toolkit';

// ✅ 1) Adapter برای پیام‌ها
// selectId → می‌گه id هر پیام چی باشه
// sortComparer → ترتیب پیش‌فرض (بر اساس created_at)
const messagesAdapter = createEntityAdapter({
  selectId: (msg) => msg.id,
  sortComparer: (a, b) =>
    (a.created_at || '').localeCompare(b.created_at || ''),
});

// ✅ 2) initialState بر اساس adapter
// می‌گه: { ids: [], entities: {}, loading: false, error: null }
const initialState = messagesAdapter.getInitialState({
  loading: false,
  error: null,
});

// ✅ 3) Slice اصلی پیام‌ها
const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // --- A) پیام لوکال (optimistic) با prepare + nanoid ---
    addLocalMessage: {
      reducer(state, action) {
        messagesAdapter.addOne(state, action.payload);
      },
      prepare({ roomId, content, senderId }) {
        return {
          payload: {
            id: nanoid(), // id یکتا سمت کلاینت
            roomId,
            content,
            senderId,
            created_at: new Date().toISOString(),
            isLocal: true, // پرچم آموزشی: پیام هنوز از سرور نیومده
          },
        };
      },
    },

    // --- B) upsertMany: لیست پیام‌ها را از سرور merge کن ---
    upsertMessages(state, action) {
      messagesAdapter.upsertMany(state, action.payload);
    },

    // --- C) ست‌کردن پیام‌های یک اتاق و پاک‌کردن قبلی‌ها ---
    setMessagesForRoom(state, action) {
      const { roomId, messages } = action.payload || {};

      // همه پیام‌های این roomId را پیدا کن
      const all = messagesAdapter.getSelectors().selectAll(state);
      const oldIds = all.filter((m) => m.roomId === roomId).map((m) => m.id);

      // قدیمی‌ها را پاک کن، جدیدها را اضافه کن
      messagesAdapter.removeMany(state, oldIds);
      messagesAdapter.addMany(state, messages || []);
    },

    // --- D) حذف یک پیام ---
    removeMessage(state, action) {
      messagesAdapter.removeOne(state, action.payload);
    },

    // --- E) فلگ‌های loading/error برای درخواست‌های async ---
    setMessagesLoading(state, action) {
      state.loading = !!action.payload;
    },
    setMessagesError(state, action) {
      state.error = action.payload || null;
    },
    clearMessagesError(state) {
      state.error = null;
    },

    // --- F) ریست کامل پیام‌ها (مثلاً بعد از logout) ---
    resetMessages() {
      return initialState;
    },
  },
});

// ✅ اکشن‌ها
export const {
  addLocalMessage,
  upsertMessages,
  setMessagesForRoom,
  removeMessage,
  setMessagesLoading,
  setMessagesError,
  clearMessagesError,
  resetMessages,
} = messagesSlice.actions;

// ✅ reducer نهایی
export default messagesSlice.reducer;

// ✅ 4) selectors عمومی adapter
const baseSelector = (state) => state.messages || initialState;

const adapterSelectors = messagesAdapter.getSelectors(baseSelector);

// همه پیام‌ها
export const selectAllMessages = (state) => adapterSelectors.selectAll(state);

// پیام بر اساس id
export const selectMessageById = (state, id) =>
  adapterSelectors.selectById(state, id);

// تعداد پیام‌ها
export const selectMessageCount = (state) =>
  adapterSelectors.selectTotal(state);

// ✅ 5) selectorهای مخصوص room
// نسخه‌ی “factory” که برای هر roomId یک selector ممویزه بسازی
export const makeSelectMessagesByRoom = (roomId) =>
  createSelector([selectAllMessages], (all) =>
    all.filter((m) => m.roomId === roomId),
  );

// نسخه‌ی ساده که هر دفعه roomId را پاس می‌دی
export const selectMessagesByRoom = (state, roomId) =>
  selectAllMessages(state).filter((m) => m.roomId === roomId);

// ✅ 6) فلگ‌های loading/error
export const selectMessagesLoading = (state) => state.messages.loading;
export const selectMessagesError = (state) => state.messages.error;
