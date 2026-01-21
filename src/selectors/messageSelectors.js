import { createSelector } from 'reselect';

const selectMessagesState = (state) => state.messages || {};
const selectAuthState = (state) => state.auth || {};

// اگر جای دیگری لیست کاربران داری، اینو نگه دار (اختیاری)
const selectUsersState = (state) => state.users || state.accounts || {}; // اگر ندارید مهم نیست

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

// ---------- rooms raw (in your state it's called groupMessages) ----------
export const selectRoomsRaw = createSelector([selectMessagesState], (s) => s.groupMessages || {});

// ---------- OPTIONAL: usersById lookup (اگر ندارید، خالی می‌مونه) ----------
export const selectUsersById = createSelector([selectUsersState], (uState) => {
  // اگر شما usersById دارید:
  if (uState?.byId) return uState.byId;
  if (uState?.usersById) return uState.usersById;
  // اگر لیست users دارید:
  if (Array.isArray(uState?.users)) {
    const out = {};
    for (const u of uState.users) out[String(u.id)] = u;
    return out;
  }
  return {};
});

// ---------- pick partnerId from users: [1,2] ----------
const pickPartnerIdFromIdsArray = (ids, currentUserId) => {
  if (!Array.isArray(ids) || !ids.length || !currentUserId) return null;
  const me = coerceId(currentUserId);

  // ids ممکنه number/string باشه
  const partner = ids.map(coerceId).find((id) => id != null && id !== me);
  return partner ?? null;
};

// ---------- Individual (DM) map ----------
export const selectIndividualMessages = createSelector(
  [selectMessagesState, selectRoomsRaw, selectCurrentUserId, selectUsersById],
  (messagesState, roomsRaw, currentUserId, usersById) => {
    const out = {};

    // 1) از existing هم می‌گیریم ولی normalize می‌کنیم
    const existing = messagesState.individualMessages || {};
    for (const [k, v] of Object.entries(existing)) {
      const partnerId = coerceId(v?.partnerId ?? v?.partner_id ?? k);
      const roomId = coerceId(v?.roomId ?? v?.room_id ?? v?.id ?? null);

      // اگر users تو existing نبود، از roomsRaw پیدا می‌کنیم
      const room = roomId != null ? roomsRaw?.[String(roomId)] : null;

      const ids =
        Array.isArray(v?.users) ? v.users :
        Array.isArray(room?.users) ? room.users :
        null;

      const pid =
        partnerId ??
        pickPartnerIdFromIdsArray(ids, currentUserId);

      const u = pid != null ? usersById?.[String(pid)] : null;

      const partner =
        pid == null
          ? null
          : {
              id: pid,
              // ✅ اگر user object نداریم، از first_name موجود تو existing استفاده کن
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
        partnerId: pid ?? null,
        roomId: roomId ?? null,
        partner, // ✅ الان همیشه یا object یا null است
        last_message: v?.last_message ?? room?.last_message ?? null,
        last_message_at: v?.last_message_at ?? room?.last_message_at ?? null,
        room: room || v?.room || null,
        // هر چی از قبل داشتی رو هم نگه دار
        ...v,
      };
    }

    // 2) اگر existing خالی بود، از roomsRaw می‌سازیم
    if (!Object.keys(out).length) {
      for (const room of Object.values(roomsRaw || {})) {
        const isPrivate = isTruthy1(room?.is_private);
        if (!isPrivate) continue;

        const pid = pickPartnerIdFromIdsArray(room?.users, currentUserId);
        const u = pid != null ? usersById?.[String(pid)] : null;

        const partner =
          pid == null
            ? null
            : {
                id: pid,
                name: u?.first_name || u?.name || u?.email || `User #${pid}`,
                avatar: u?.photo || u?.profile_picture || u?.avatar || null,
              };

        const key = pid != null ? String(pid) : String(room?.id);

        out[key] = {
          partnerId: pid ?? null,
          roomId: room?.id ?? null,
          partner,
          last_message: room?.last_message ?? null,
          last_message_at: room?.last_message_at ?? null,
          room,
        };
      }
    }

    return out;
  },
);


// ---------- Group map (real groups only) ----------
export const selectGroupMessages = createSelector([selectRoomsRaw], (roomsRaw) => {
  const out = {};
  for (const [id, room] of Object.entries(roomsRaw)) {
    if (isTruthy1(room?.is_private)) continue; // private ها گروه نیستند
    out[id] = room;
  }
  return out;
});

// ---------- Loading / Error / Typing / SelectedRoom ----------
export const selectLoading = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.loadingStates?.messages ?? false,
);

export const selectError = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.errorStates?.messages ?? null,
);

export const selectTypingIndicators = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.typingIndicators || {},
);

export const selectSelectedRoom = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.selectedRoom ?? null,
);
