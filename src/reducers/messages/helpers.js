// chatApp-frontend\src\reducers\messages\helpers.js

export const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export const getUserId = (u) =>
  u?.id ?? u?.user_id ?? u?.userId ?? u?.pk ?? u?.uid ?? null;

export const getPartnerIdFromConv = (c) =>
  c?.partnerId ?? c?.partner_id ?? c?.user_id ?? c?.id ?? null;

export const getRoomIdFromConv = (c) =>
  c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.chatRoomId ?? c?.room?.id ?? null;

/**
 * ✅ DM/Message schema compatibility
 * - legacy: sender_id / receiver_id
 * - reverb+sanctum: user_id (+ chat_room_id) و گیرنده در پیام نیست
 */
export const getMsgIds = (m) => {
  const senderId =
    m?.sender_id ??
    m?.senderId ??
    m?.user_id ??
    m?.user?.id ??
    m?.sender?.id ??
    m?.from_user_id ??
    null;

  const receiverId =
    m?.receiver_id ??
    m?.receiverId ??
    m?.to_user_id ??
    m?.receiver?.id ??
    m?.to?.id ??
    null;

  const roomId =
    m?.chat_room_id ??
    m?.chatRoomId ??
    m?.room_id ??
    m?.roomId ??
    m?.room?.id ??
    null;

  return { senderId, receiverId, roomId };
};

export const makeDefaultConversation = (partnerId, userObj = {}, roomId = null) => ({
  partnerId,
  roomId: roomId ?? null,
  first_name:
    userObj.first_name ||
    userObj.firstName ||
    userObj.name ||
    userObj.email ||
    `User #${partnerId}`,
  last_message: null,
  last_message_at: null,
  unread_count: 0,
  is_online: !!userObj.is_online,
  messages: [],
});
