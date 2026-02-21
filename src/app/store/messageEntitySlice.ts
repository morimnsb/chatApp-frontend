import {
  createSlice,
  createEntityAdapter,
  nanoid,
  createSelector,
  type PayloadAction,
  type EntityId,
} from "@reduxjs/toolkit";
import type { RootState } from "@/app/store/store";

/* -------------------- types -------------------- */

export type MsgId = EntityId; // = string | number

export type MessageEntity = {
  id: MsgId;           // ✅ server id یا nanoid
  roomId: MsgId;
  content: string;
  senderId: MsgId;     // ✅ این رو ثابت نگه دار تا با بقیه کد یکی باشه
  created_at: string;

  isLocal?: boolean;
  kind?: string | null;
  [k: string]: any;
};

type MessagesEntityExtraState = {
  loading: boolean;
  error: string | null;
};

/* -------------------- adapter -------------------- */
// ✅ در RTK جدید: selectId را نده، چون id موجود است
const messagesAdapter = createEntityAdapter<MessageEntity>({
  sortComparer: (a, b) => (a.created_at || "").localeCompare(b.created_at || ""),
});

/* -------------------- initialState -------------------- */
// ✅ بهترین روش: state را از getInitialState بگیر (EntityState<T,Id> خودش درست میشه)
const initialState = messagesAdapter.getInitialState<MessagesEntityExtraState>({
  loading: false,
  error: null,
});

export type MessagesEntityState = typeof initialState;

/* -------------------- slice -------------------- */

const messagesEntitySlice = createSlice({
  name: "messagesEntity",
  initialState,
  reducers: {
    addLocalMessage: {
      reducer(state, action: PayloadAction<MessageEntity>) {
        messagesAdapter.addOne(state, action.payload);
      },
      prepare(args: { roomId: MsgId; content: string; senderId: MsgId }) {
        const { roomId, content, senderId } = args;

        const payload: MessageEntity = {
          id: nanoid(),
          roomId,
          content,
          senderId,
          created_at: new Date().toISOString(),
          isLocal: true,
        };

        return { payload };
      },
    },

    upsertMessages(state, action: PayloadAction<MessageEntity[]>) {
      messagesAdapter.upsertMany(state, action.payload);
    },

    setMessagesForRoom(
      state,
      action: PayloadAction<{ roomId: MsgId; messages: MessageEntity[] } | undefined>
    ) {
      const payload = action.payload;
      if (!payload) return;

      const { roomId, messages } = payload;

      const all = messagesAdapter.getSelectors().selectAll(state);
      const oldIds = all.filter((m) => m.roomId === roomId).map((m) => m.id);

      messagesAdapter.removeMany(state, oldIds);
      messagesAdapter.addMany(state, messages || []);
    },

    removeMessage(state, action: PayloadAction<MsgId>) {
      messagesAdapter.removeOne(state, action.payload);
    },

    setMessagesLoading(state, action: PayloadAction<boolean>) {
      state.loading = Boolean(action.payload);
    },
    setMessagesError(state, action: PayloadAction<string | null | undefined>) {
      state.error = action.payload ?? null;
    },
    clearMessagesError(state) {
      state.error = null;
    },

    resetMessages() {
      return initialState;
    },
  },
});

export const {
  addLocalMessage,
  upsertMessages,
  setMessagesForRoom,
  removeMessage,
  setMessagesLoading,
  setMessagesError,
  clearMessagesError,
  resetMessages,
} = messagesEntitySlice.actions;

export default messagesEntitySlice.reducer;

/* -------------------- selectors -------------------- */

const baseSelector = (state: RootState): MessagesEntityState =>
  state.messagesEntity ?? initialState;

// ✅ این generic مهمه تا getSelectors overload درست انتخاب بشه
const adapterSelectors = messagesAdapter.getSelectors<RootState>(baseSelector);

export const selectAllMessagesEntity = (state: RootState) =>
  adapterSelectors.selectAll(state);

export const selectMessageEntityById = (state: RootState, id: MsgId) =>
  adapterSelectors.selectById(state, id);

export const selectMessageEntityCount = (state: RootState) =>
  adapterSelectors.selectTotal(state);

export const makeSelectMessagesByRoom = (roomId: MsgId) =>
  createSelector([selectAllMessagesEntity], (all) =>
    all.filter((m) => m.roomId === roomId)
  );

export const selectMessagesByRoom = (state: RootState, roomId: MsgId) =>
  selectAllMessagesEntity(state).filter((m) => m.roomId === roomId);

export const selectMessagesLoading = (state: RootState) =>
  baseSelector(state).loading;

export const selectMessagesError = (state: RootState) =>
  baseSelector(state).error;