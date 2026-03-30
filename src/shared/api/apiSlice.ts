// chatApp-frontend/src/shared/api/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import type { RootState } from "@/app/store/store";
import {
  getBackend,
  resolveApiBase,
  buildEndpoints,
  type BackendConfig,
} from "@/shared/backend";

const stripBearer = (t: unknown) =>
  String(t || "").replace(/^Bearer\s+/i, "").trim();

const getLS = (k: string) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};

type DynamicBaseQuery = BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
>;

function getActiveBackend(): BackendConfig {
  return getBackend();
}

function getBaseUrl(): string {
  return resolveApiBase(getActiveBackend());
}

function getEndpoints() {
  return buildEndpoints(getActiveBackend());
}

const dynamicBaseQuery: DynamicBaseQuery = async (args, api, extraOptions) => {
  const backend = getActiveBackend();
  const baseUrl = resolveApiBase(backend);

  const baseQuery = fetchBaseQuery({
    baseUrl,
    credentials: backend.key === "reverb" ? "include" : "omit",
    prepareHeaders: (headers, { getState, endpoint, type }) => {
      const state = getState?.() as RootState | undefined;

      const tokenFromRedux = state?.auth?.access_token;
      const tokenFromLS = getLS("access_token");
      const token = stripBearer(tokenFromRedux || tokenFromLS);

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      headers.set("Accept", "application/json");

      // فقط وقتی لازم است Content-Type را ست کن
      // fetchBaseQuery برای body JSON خودش هم خوب هندل می‌کند،
      // ولی برای سازگاری بیشتر نگهش می‌داریم.
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      return headers;
    },
  });

  return baseQuery(args, api, extraOptions);
};

/* -------------------- minimal API types -------------------- */
export type ApiUser = {
  id: number | string;
  name?: string | null;
  email?: string | null;
  [k: string]: any;
};

export type RoomId = number | string;

export type ApiRoom = {
  id: RoomId;
  name?: string | null;
  last_message?: any;
  [k: string]: any;
};

export type ApiMessage = {
  id?: number | string;
  chat_room_id?: RoomId;
  room_id?: RoomId;
  user_id?: number | string;
  sender_id?: number | string;
  content?: string | null;
  text?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  tagTypes: ["Me", "Users", "Rooms", "Messages", "Friends", "Convos"],
  endpoints: (builder) => ({
    getMe: builder.query<ApiUser, void>({
      query: () => getEndpoints().me,
      providesTags: ["Me"],
    }),

    getUsers: builder.query<ApiUser[], void>({
      query: () => getEndpoints().users,
      providesTags: ["Users"],
    }),

    getRooms: builder.query<ApiRoom[], void>({
      query: () => getEndpoints().rooms,
      providesTags: ["Rooms"],
    }),

    getConversations: builder.query<any[], void>({
      query: () => getEndpoints().convos,
      providesTags: ["Convos"],
    }),

    getRoomMessages: builder.query<ApiMessage[], RoomId>({
      query: (roomId) => getEndpoints().roomMessages(roomId),
      providesTags: (_res, _err, roomId) => [{ type: "Messages", id: roomId }],
    }),

    sendMessage: builder.mutation<ApiMessage, { roomId: RoomId; content: string }>({
      query: ({ roomId, content }) => ({
        url: getEndpoints().roomMessages(roomId),
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (_res, _err, { roomId }) => [
        { type: "Messages", id: roomId },
        "Rooms",
        "Convos",
      ],
    }),

    sendFriendRequest: builder.mutation<any, { to_user_id: number | string }>({
      query: ({ to_user_id }) => ({
        url: getEndpoints().friend,
        method: "POST",
        body: { to_user_id },
      }),
      invalidatesTags: ["Friends"],
    }),

    respondFriendRequest: builder.mutation<
      any,
      { friendship_id: number | string; action: string }
    >({
      query: ({ friendship_id, action }) => ({
        url: getEndpoints().friendRespond,
        method: "POST",
        body: { friendship_id, action },
      }),
      invalidatesTags: ["Friends"],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetUsersQuery,
  useGetRoomsQuery,
  useGetConversationsQuery,
  useGetRoomMessagesQuery,
  useSendMessageMutation,
  useSendFriendRequestMutation,
  useRespondFriendRequestMutation,
} = apiSlice;

/* -------------------- optional debug helpers -------------------- */
export { getActiveBackend, getBaseUrl, getEndpoints };