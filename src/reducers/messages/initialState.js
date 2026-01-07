export const initialState = {
  currentUser: {},
  users: {},

  individualMessages: {},
  groupMessages: {},

  selectedRoom: null,

  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },

  typingIndicators: {},
};
