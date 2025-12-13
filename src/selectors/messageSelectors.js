// src/selectors/messageSelectors.js
import { createSelector } from 'reselect';

// روت استیت messages
const selectMessagesState = (state) => state.messages || {};

// ✅ لیست چت‌های فردی (map: { [partnerId]: convObj })
export const selectIndividualMessages = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.individualMessages || {},
);

// ✅ لیست گروه‌ها (map)
export const selectGroupMessages = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.groupMessages || {},
);

// ✅ لودینگ کلی (الان فقط messages رو برمی‌داریم)
export const selectLoading = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.loadingStates?.messages ?? false,
);

// ✅ ارور کلی
export const selectError = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.errorStates?.messages ?? null,
);

// ✅ تایپینگ
export const selectTypingIndicators = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.typingIndicators || {},
);

// اگر بعداً لازم شد:
export const selectSelectedRoom = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.selectedRoom ?? null,
);
