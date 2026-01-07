export const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export const getUserId = (u) => u?.id ?? u?.user_id ?? u?.userId ?? u?.pk ?? null;

export const getPartnerIdFromConv = (c) =>
  c?.partnerId ?? c?.partner_id ?? c?.user_id ?? c?.id ?? null;

export const getRoomIdFromConv = (c) =>
  c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.room?.id ?? null;

export const getMsgIds = (m) => ({
  senderId: m?.sender_id ?? m?.senderId ?? m?.user_id ?? null,
  receiverId: m?.receiver_id ?? m?.receiverId ?? null,
  roomId: m?.chat_room_id ?? m?.room_id ?? m?.roomId ?? null,
});

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
