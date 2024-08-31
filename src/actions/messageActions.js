// src/store/actions/messageActions.js

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
 * @param {boolean} [isTyping=false] - Flag indicating if it's a typing indicator.
 * @param {boolean} [isStatus=false] - Flag indicating if it's a status update.
 */
export const updateMessages = (msg, isTyping = false, isStatus = false) => ({
  type: messageActionTypes.UPDATE_MESSAGES,
  payload: { msg, isTyping, isStatus },
});

/**
 * Resets the typing indicator for a specific user or room.
 * @param {string} identifier - The ID of the user or room.
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
 * Updates the last message of a conversation.
 * @param {string} senderId - The ID of the sender.
 * @param {Object} lastMessage - The last message object.
 */
export const updateLastMessage = (senderId, lastMessage) => ({
  type: messageActionTypes.UPDATE_LAST_MESSAGE,
  payload: { senderId, lastMessage },
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
 * Sets the typing indicator for a specific room.
 * @param {string} roomId - The ID of the room.
 * @param {boolean} isTyping - Indicates whether typing is in progress.
 */
// export const setTypingIndicator = (roomId, isTyping) => ({
//   type: messageActionTypes.SET_TYPING_INDICATOR,
//   payload: { roomId, isTyping },
// });
export const setTypingIndicator = (payload) => ({
  type: messageActionTypes.SET_TYPING_INDICATOR,
  payload,
});
