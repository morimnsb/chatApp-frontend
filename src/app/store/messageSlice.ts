// // src/store/messageSlice.js
// import {
//   createSlice,
//   createEntityAdapter,
//   nanoid,
//   createSelector,
//   type PayloadAction,
//   type EntityState,
// } from "@reduxjs/toolkit";
// import type { RootState } from "@/app/store/store";

// /* -------------------- types -------------------- */

// type Id = string | number;

// export type MessageEntity = {
//   id: Id;                 // server id یا nanoid برای local
//   roomId: Id;
//   content: string;
//   senderId: Id;
//   created_at: string;

//   // optional flags/fields
//   isLocal?: boolean;
//   kind?: string | null;
//   [k: string]: any;
// };

// export type MessagesEntityExtraState = {
//   loading: boolean;
//   error: string | null;
// };

// export type MessagesEntityState = EntityState<MessageEntity> & MessagesEntityExtraState;

// /* -------------------- adapter -------------------- */

// const messagesAdapter = createEntityAdapter<MessageEntity>({
//   selectId: (msg) => msg.id,
//   sortComparer: (a, b) => (a.created_at || "").localeCompare(b.created_at || ""),
// });

// /* -------------------- initialState -------------------- */

// const initialState: MessagesEntityState = messagesAdapter.getInitialState({
//   loading: false,
//   error: null,
// });

// /* -------------------- slice -------------------- */

// const messagesEntitySlice = createSlice({
//   name: "messagesEntity",
//   initialState,
//   reducers: {
//     // --- A) پیام لوکال (optimistic) با prepare + nanoid ---
//     addLocalMessage: {
//       reducer(state, action: PayloadAction<MessageEntity>) {
//         messagesAdapter.addOne(state, action.payload);
//       },
//       prepare(args: { roomId: Id; content: string; senderId: Id }) {
//         const { roomId, content, senderId } = args;

//         return {
//           payload: {
//             id: nanoid(),
//             roomId,
//             content,
//             senderId,
//             created_at: new Date().toISOString(),
//             isLocal: true,
//           } satisfies MessageEntity,
//         };
//       },
//     },

//     // --- B) upsertMany: لیست پیام‌ها را از سرور merge کن ---
//     upsertMessages(state, action: PayloadAction<MessageEntity[]>) {
//       messagesAdapter.upsertMany(state, action.payload);
//     },

//     // --- C) ست‌کردن پیام‌های یک اتاق و پاک‌کردن قبلی‌ها ---
//     setMessagesForRoom(
//       state,
//       action: PayloadAction<{ roomId: Id; messages: MessageEntity[] } | undefined>
//     ) {
//       const payload = action.payload;
//       if (!payload) return;

//       const { roomId, messages } = payload;

//       // همه پیام‌های این roomId را پیدا کن
//       const all = messagesAdapter.getSelectors().selectAll(state);
//       const oldIds = all.filter((m) => m.roomId === roomId).map((m) => m.id);

//       // قدیمی‌ها را پاک کن، جدیدها را اضافه کن
//       messagesAdapter.removeMany(state, oldIds);
//       messagesAdapter.addMany(state, messages || []);
//     },

//     // --- D) حذف یک پیام ---
//     removeMessage(state, action: PayloadAction<Id>) {
//       messagesAdapter.removeOne(state, action.payload);
//     },

//     // --- E) فلگ‌های loading/error برای درخواست‌های async ---
//     setMessagesLoading(state, action: PayloadAction<boolean>) {
//       state.loading = Boolean(action.payload);
//     },
//     setMessagesError(state, action: PayloadAction<string | null | undefined>) {
//       state.error = action.payload ?? null;
//     },
//     clearMessagesError(state) {
//       state.error = null;
//     },

//     // --- F) ریست کامل پیام‌ها (مثلاً بعد از logout) ---
//     resetMessages() {
//       return initialState;
//     },
//   },
// });

// export const {
//   addLocalMessage,
//   upsertMessages,
//   setMessagesForRoom,
//   removeMessage,
//   setMessagesLoading,
//   setMessagesError,
//   clearMessagesError,
//   resetMessages,
// } = messagesEntitySlice.actions;

// export default messagesEntitySlice.reducer;

// /* -------------------- selectors -------------------- */

// // ✅ در store شما key این slice: messagesEntity
// const baseSelector = (state: RootState) => state.messagesEntity ?? initialState;

// const adapterSelectors = messagesAdapter.getSelectors(baseSelector);

// export const selectAllMessagesEntity = (state: RootState) =>
//   adapterSelectors.selectAll(state);

// export const selectMessageEntityById = (state: RootState, id: Id) =>
//   adapterSelectors.selectById(state, id as any);

// export const selectMessageEntityCount = (state: RootState) =>
//   adapterSelectors.selectTotal(state);

// // ✅ selectorهای مخصوص room
// export const makeSelectMessagesByRoom = (roomId: Id) =>
//   createSelector([selectAllMessagesEntity], (all) =>
//     all.filter((m) => m.roomId === roomId)
//   );

// export const selectMessagesByRoom = (state: RootState, roomId: Id) =>
//   selectAllMessagesEntity(state).filter((m) => m.roomId === roomId);

// // ✅ فلگ‌های loading/error
// export const selectMessagesLoading = (state: RootState) =>
//   baseSelector(state).loading;

// export const selectMessagesError = (state: RootState) =>
//   baseSelector(state).error;