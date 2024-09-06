import { createSelector } from 'reselect';

const selectMessagesState = (state) => state.messages;

export const selectIndividualMessages = createSelector(
  [selectMessagesState],
  (messagesState) => Object.values(messagesState.individualMessages),
);

export const selectGroupMessages = createSelector(
  [selectMessagesState],
  (messagesState) => Object.values(messagesState.groupMessages),
);

export const selectLoading = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.loading,
);

export const selectError = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.error,
);

export const selectTypingIndicators = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.typingIndicators,
);
