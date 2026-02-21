import messageActionTypes, { type MessageActionType } from "./messageActionTypes";

type AnyRecord = Record<string, any>;
type Id = string | number;

/* -------------------- payload types (soft) -------------------- */

export type ChatUser = AnyRecord & {
  id?: Id;
  user_id?: Id;
  name?: string;
  email?: string;
};

export type TypingPayload =
  | { userId: Id; isTyping: boolean; roomId?: Id }
  | { user_id: Id; isTyping: boolean; room_id?: Id }
  | AnyRecord;

export type UpdateStatusPayload = {
  senderId: Id;
  status: boolean;
};

export type UpdateMessagesPacket = AnyRecord; // چون shape تو پروژه چند بک‌اندی متغیره

/* -------------------- action types -------------------- */

export type Action<T extends MessageActionType, P> = {
  type: T;
  payload: P;
};

export type SetCurrentUserAction = Action<typeof messageActionTypes.SET_CURRENT_USER, ChatUser | null>;
export type SetUsersAction = Action<typeof messageActionTypes.SET_USERS, ChatUser[]>;
export type SetIndividualMessagesAction = Action<typeof messageActionTypes.SET_INDIVIDUAL_MESSAGES, any>;
export type SetGroupMessagesAction = Action<typeof messageActionTypes.SET_GROUP_MESSAGES, any>;
export type SelectRoomAction = Action<typeof messageActionTypes.SELECT_ROOM, Id | null>;

export type UpdateMessagesAction = Action<typeof messageActionTypes.UPDATE_MESSAGES, UpdateMessagesPacket>;

export type UpdateStatusAction = Action<typeof messageActionTypes.UPDATE_STATUS, UpdateStatusPayload>;
export type ResetTypingIndicatorAction = Action<
  typeof messageActionTypes.RESET_TYPING_INDICATOR,
  { userId: Id } | { user_id: Id }
>;
export type ClearUnreadCountAction = Action<typeof messageActionTypes.CLEAR_UNREAD_COUNT, Id>;

export type SetLoadingAction = Action<typeof messageActionTypes.SET_LOADING, boolean>;
export type SetErrorAction = Action<typeof messageActionTypes.SET_ERROR, ChatErrorPayload>;
export type SetTypingIndicatorAction = Action<typeof messageActionTypes.SET_TYPING_INDICATOR, TypingPayload>;

// اگر خواستی بعداً تو reducer از union استفاده کنی:
export type MessageActions =
  | SetCurrentUserAction
  | SetUsersAction
  | SetIndividualMessagesAction
  | SetGroupMessagesAction
  | SelectRoomAction
  | UpdateMessagesAction
  | UpdateStatusAction
  | ResetTypingIndicatorAction
  | ClearUnreadCountAction
  | SetLoadingAction
  | SetErrorAction
  | SetTypingIndicatorAction;

/* -------------------- action creators -------------------- */

export const setCurrentUser = (user: ChatUser | null): SetCurrentUserAction => ({
  type: messageActionTypes.SET_CURRENT_USER,
  payload: user,
});

export const setUsers = (users: ChatUser[]): SetUsersAction => ({
  type: messageActionTypes.SET_USERS,
  payload: Array.isArray(users) ? users : [],
});

export const setIndividualMessages = (messages: any): SetIndividualMessagesAction => ({
  type: messageActionTypes.SET_INDIVIDUAL_MESSAGES,
  payload: messages,
});

export const setGroupMessages = (groupMessages: any): SetGroupMessagesAction => ({
  type: messageActionTypes.SET_GROUP_MESSAGES,
  payload: groupMessages,
});

export const selectRoom = (roomId: Id | null): SelectRoomAction => ({
  type: messageActionTypes.SELECT_ROOM,
  payload: roomId,
});

// ✅ packet را مستقیم بفرست
export const updateMessages = (packet: UpdateMessagesPacket): UpdateMessagesAction => ({
  type: messageActionTypes.UPDATE_MESSAGES,
  payload: packet,
});

export const updateStatus = (senderId: Id, status: boolean): UpdateStatusAction => ({
  type: messageActionTypes.UPDATE_STATUS,
  payload: { senderId, status },
});

export const resetTypingIndicator = (userId: Id): ResetTypingIndicatorAction => ({
  type: messageActionTypes.RESET_TYPING_INDICATOR,
  payload: { userId },
});

export const clearUnreadCount = (conversationId: Id): ClearUnreadCountAction => ({
  type: messageActionTypes.CLEAR_UNREAD_COUNT,
  payload: conversationId,
});

export const setLoading = (isLoading: boolean): SetLoadingAction => ({
  type: messageActionTypes.SET_LOADING,
  payload: Boolean(isLoading),
});

export const setError = (error: ChatErrorPayload): SetErrorAction => ({
  type: messageActionTypes.SET_ERROR,
  payload: error ?? null,
});

export const setTypingIndicator = (payload: TypingPayload): SetTypingIndicatorAction => ({
  type: messageActionTypes.SET_TYPING_INDICATOR,
  payload,
});

// ✅ backward compat alias
export const updateFromPacket = (packet: UpdateMessagesPacket): UpdateMessagesAction => ({
  type: messageActionTypes.UPDATE_MESSAGES,
  payload: packet,
});