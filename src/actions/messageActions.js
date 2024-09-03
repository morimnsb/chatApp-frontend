import messageActionTypes from './messageActionTypes';

/**
 * Sets the current user information in the Redux store.
 * @param {Object} user - The current user object.
 */
export const setCurrentUser = (user) => ({
  type: messageActionTypes.SET_CURRENT_USER,
  payload: user,
});

/**
 * Sets the list of all users in the Redux store.
 * @param {Array} users - An array of user objects.
 */
export const setUsers = (users) => ({
  type: messageActionTypes.SET_USERS,
  payload: users,
});

/**
 * Sets the list of individual (one-on-one) conversations in the Redux store.
 * @param {Array} messages - An array of conversation objects.
 */
export const setIndividualMessages = (messages) => ({
  type: messageActionTypes.SET_INDIVIDUAL_MESSAGES,
  payload: messages,
});

/**
 * Sets the list of group conversations in the Redux store.
 * @param {Array} groupMessages - An array of group conversation objects.
 */
export const setGroupMessages = (groupMessages) => ({
  type: messageActionTypes.SET_GROUP_MESSAGES,
  payload: groupMessages,
});

/**
 * Selects a chat room by updating the selectedRoom in the Redux store.
 * @param {string} roomId - The ID of the room to select.
 */
export const selectRoom = (roomId) => ({
  type: messageActionTypes.SELECT_ROOM,
  payload: roomId,
});

/**
 * Updates messages based on different scenarios: new message, typing indicator, or status update.
 * @param {Object} msg - The message object containing message details.
 */
export const updateMessages = (message) => ({
  type: messageActionTypes.UPDATE_MESSAGES,
  payload: { message },
});

/**
 * Updates the online status of a user in a conversation.
 * @param {string} senderId - The ID of the sender.
 * @param {boolean} status - The online status of the user.
 */
export const updateStatus = (senderId, status) => ({
  type: messageActionTypes.UPDATE_STATUS,
  payload: { senderId, status },
});

/**
 * Resets the typing indicator for a specific user or room.
 * @param {string} userId - The ID of the user or room.
 */
export const resetTypingIndicator = (userId) => ({
  type: messageActionTypes.RESET_TYPING_INDICATOR,
  payload: { userId },
});

/**
 * Clears the unread message count for a specific conversation.
 * @param {string} conversationId - The ID of the conversation.
 */
export const clearUnreadCount = (conversationId) => ({
  type: messageActionTypes.CLEAR_UNREAD_COUNT,
  payload: conversationId,
});



/**
 * Sets the loading state in the Redux store.
 * @param {boolean} isLoading - The loading state.
 */
export const setLoading = (isLoading) => ({
  type: messageActionTypes.SET_LOADING,
  payload: isLoading,
});

/**
 * Sets the error state in the Redux store.
 * @param {string} error - The error message.
 */
export const setError = (error) => ({
  type: messageActionTypes.SET_ERROR,
  payload: error,
});

/**
 * Sets the typing indicator for a specific user or room.
 * @param {Object} payload - The object containing userId or roomId and isTyping status.
 */
export const setTypingIndicator = (payload) => ({
  type: messageActionTypes.SET_TYPING_INDICATOR,
  payload,
});
