// chatApp-frontend\src\reducers\messages\initialState.js
export const initialState = {
  currentUser: {},
  users: {},

  // DM map by partnerId
  individualMessages: {},

  // ✅ All rooms (DM + Group) by roomId
  rooms: {},

  // Group map by roomId (optional / backward compatible)
  groupMessages: {},

  selectedRoom: null,

  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },

  typingIndicators: {},
};
