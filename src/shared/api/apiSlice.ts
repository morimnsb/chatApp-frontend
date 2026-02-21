//chatApp-frontend\src\shared\api\apiSlice.ts
// src/shared/api/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import type { RootState } from "@/app/store/store";
import { getBackend, resolveApiBase, buildEndpoints } from "@/shared/backend";

const stripBearer = (t: unknown) => String(t || "").replace(/^Bearer\s+/i, "").trim();

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

const dynamicBaseQuery: DynamicBaseQuery = async (args, api, extraOptions) => {
  const backend = getBackend();              // ✅ backend object
  const baseUrl = resolveApiBase(backend);   // ✅ base url

  const baseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState?.() as RootState | undefined;

      const tokenFromRedux = state?.auth?.access_token;
      const tokenFromLS = getLS("access_token");
      const token = stripBearer(tokenFromRedux || tokenFromLS);

      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Accept", "application/json");
      headers.set("Content-Type", "application/json");
      return headers;
    },

    // ✅ برای reverb/laravel شاید credentials لازم باشه
    credentials: backend.key === "reverb" ? "include" : "omit",
  });

  return baseQuery(args, api, extraOptions);
};

/* -------------------- minimal API types -------------------- */
// اگر خواستی بعداً دقیق‌ترش کنیم، اینجا بهترین نقطه‌ست.

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
  user_id?: number | string;
  content?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  tagTypes: ["Me", "Users", "Rooms", "Messages", "Friends", "Convos"],
  endpoints: (builder) => ({
    getMe: builder.query<ApiUser, void>({
      query: () => buildEndpoints(getBackend()).me,
      providesTags: ["Me"],
    }),

    getUsers: builder.query<ApiUser[], void>({
      query: () => buildEndpoints(getBackend()).users,
      providesTags: ["Users"],
    }),

    getRooms: builder.query<ApiRoom[], void>({
      query: () => buildEndpoints(getBackend()).rooms,
      providesTags: ["Rooms"],
    }),

    // conversations shape تو پروژه‌ت ممکنه متفاوت باشه → any[] فعلاً امن‌تره
    getConversations: builder.query<any[], void>({
      query: () => buildEndpoints(getBackend()).convos,
      providesTags: ["Convos"],
    }),

    getRoomMessages: builder.query<ApiMessage[], RoomId>({
      query: (roomId) => buildEndpoints(getBackend()).roomMessages(roomId),
      providesTags: (_res, _err, roomId) => [{ type: "Messages", id: roomId }],
    }),

    sendMessage: builder.mutation<
      ApiMessage,
      { roomId: RoomId; content: string }
    >({
      query: ({ roomId, content }) => ({
        url: buildEndpoints(getBackend()).roomMessages(roomId),
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (_res, _err, { roomId }) => [
        { type: "Messages", id: roomId },
        "Rooms",
      ],
    }),

    sendFriendRequest: builder.mutation<
      any,
      { to_user_id: number | string }
    >({
      query: ({ to_user_id }) => ({
        url: buildEndpoints(getBackend()).friend,
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
        url: buildEndpoints(getBackend()).friendRespond,
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