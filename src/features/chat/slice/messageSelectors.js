// src/selectors/messageSelectors.js
import { createSelector } from 'reselect';

const EMPTY_OBJ = Object.freeze({});
const EMPTY_ARR = Object.freeze([]);

// base
const selectMessagesState = (state) => state.messages ?? EMPTY_OBJ;
const selectAuthState = (state) => state.auth ?? EMPTY_OBJ;
const selectUsersState = (state) => state.users ?? state.accounts ?? EMPTY_OBJ;

const coerceId = (v) => (v == null ? null : Number(v) || String(v));
const isTruthy1 = (v) => v === true || v === 1 || v === '1';

// ---------- current user id ----------
export const selectCurrentUserId = createSelector([selectAuthState], (auth) => {
  const id =
    auth?.user?.id ??
    auth?.user?.user_id ??
    auth?.currentUser?.id ??
    auth?.currentUser?.user_id ??
    null;
  return id == null ? null : coerceId(id);
});

// ✅ IMPORTANT: اینا نباید createSelector باشند (identity warning میده)
// ---------- RAW selectors (NO createSelector) ----------
export const selectRoomsRaw = (state) =>
  (state.messages?.rooms ??
    state.messages?.roomsRaw ?? // اگر قدیمی داشتی
    EMPTY_OBJ);


export const selectIndividualRaw = (state) =>
  state.messages?.individualMessages ?? EMPTY_OBJ;

// typing/loading/error/selected
export const selectTypingIndicators = (state) =>
  state.messages?.typingIndicators ?? EMPTY_OBJ;

export const selectLoading = (state) => {
  const s = state.messages ?? EMPTY_OBJ;
  if (typeof s.loading === 'boolean') return s.loading;
  return Boolean(s.loadingStates?.messages);
};

export const selectError = (state) => {
  const s = state.messages ?? EMPTY_OBJ;
  if (s.error != null) return s.error;
  return s.errorStates?.messages ?? null;
};

export const selectSelectedRoom = (state) =>
  state.messages?.selectedRoom ?? state.messages?.selectedRoomId ?? null;

// ---------- usersById (memoized safely) ----------
const selectUsersByIdDirect = createSelector([selectUsersState], (u) => u?.byId ?? u?.usersById ?? null);
const selectUsersArray = createSelector([selectUsersState], (u) => (Array.isArray(u?.users) ? u.users : null));

export const selectUsersById = createSelector(
  [selectUsersByIdDirect, selectUsersArray],
  (byId, usersArr) => {
    if (byId && typeof byId === 'object') return byId;
    if (!usersArr) return EMPTY_OBJ;
    const out = {};
    for (const u of usersArr) {
      const id = u?.id ?? u?.user_id;
      if (id != null) out[String(id)] = u;
    }
    return out;
  },
);

export const selectUsersByIdRaw = selectUsersById;

// ---------- helpers ----------
const pickPartnerIdFromIdsArray = (ids, currentUserId) => {
  if (!Array.isArray(ids) || !ids.length || !currentUserId) return null;
  const me = coerceId(currentUserId);
  return ids.map(coerceId).find((id) => id != null && id !== me) ?? null;
};

// ---------- Individual map ----------
export const selectIndividualMessages = createSelector(
  [selectIndividualRaw, selectRoomsRaw, selectCurrentUserId, selectUsersById],
  (individualRaw, roomsRaw, currentUserId, usersById) => {
    const out = {};
    const entries = Object.entries(individualRaw ?? EMPTY_OBJ);

    if (entries.length) {
      for (const [k, v] of entries) {
        const roomId = coerceId(v?.roomId ?? v?.room_id ?? v?.id ?? null);
        const room = roomId != null ? roomsRaw?.[String(roomId)] : null;

        const ids =
          Array.isArray(v?.users) ? v.users :
          Array.isArray(room?.users) ? room.users :
          null;

        const partnerIdGuess = coerceId(v?.partnerId ?? v?.partner_id ?? v?.user_id ?? k);
        const pid = partnerIdGuess ?? pickPartnerIdFromIdsArray(ids, currentUserId);

        const u = pid != null ? usersById?.[String(pid)] : null;

        const partner =
          pid == null
            ? null
            : {
                id: pid,
                name:
                  u?.first_name ||
                  u?.name ||
                  u?.email ||
                  v?.first_name ||
                  v?.partner_name ||
                  `User #${pid}`,
                avatar:
                  u?.photo ||
                  u?.profile_picture ||
                  u?.avatar ||
                  v?.photo ||
                  v?.avatar ||
                  null,
              };

        const key = pid != null ? String(pid) : String(k);

        out[key] = {
          ...v,
          partnerId: pid ?? null,
          roomId: roomId ?? null,
          partner,
          last_message: v?.last_message ?? room?.last_message ?? null,
          last_message_at: v?.last_message_at ?? room?.last_message_at ?? null,
          room: room || v?.room || null,
        };
      }
      return out;
    }

    // fallback from rooms
    for (const room of Object.values(roomsRaw ?? EMPTY_OBJ)) {
      if (!isTruthy1(room?.is_private)) continue;

      const pid = pickPartnerIdFromIdsArray(room?.users, currentUserId);
      const u = pid != null ? usersById?.[String(pid)] : null;

      const key = pid != null ? String(pid) : String(room?.id);

      out[key] = {
        partnerId: pid ?? null,
        roomId: room?.id ?? null,
        partner:
          pid == null
            ? null
            : {
                id: pid,
                name: u?.first_name || u?.name || u?.email || `User #${pid}`,
                avatar: u?.photo || u?.profile_picture || u?.avatar || null,
              },
        last_message: room?.last_message ?? null,
        last_message_at: room?.last_message_at ?? null,
        room,
      };
    }

    return out;
  },
);

// ---------- Groups map ----------
export const selectGroupMessages = createSelector([selectRoomsRaw], (roomsRaw) => {
  const out = {};
  for (const [id, room] of Object.entries(roomsRaw ?? EMPTY_OBJ)) {
    if (isTruthy1(room?.is_private)) continue;
    out[id] = room;
  }
  return out;
});

