// src/services/apiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getBackend, resolveApiBase, buildEndpoints } from "@/shared/backend";

const stripBearer = (t) => String(t || "").replace(/^Bearer\s+/i, "").trim();
const getLS = (k) => {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
};

const dynamicBaseQuery = async (args, api, extraOptions) => {
  const backend = getBackend();                 // ✅ backend object
  const endpoints = buildEndpoints(backend);    // ✅ paths
  const baseUrl = resolveApiBase(backend);      // ✅ base url

  const baseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState?.();
      const tokenFromRedux = state?.auth?.access_token;
      const tokenFromLS = getLS("access_token");
      const token = stripBearer(tokenFromRedux || tokenFromLS);

      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Accept", "application/json");
      headers.set("Content-Type", "application/json");
      return headers;
    },

    // ✅ برای reverb/laravel شاید credentials لازم باشه
    // اگر می‌خوای بر اساس backend تصمیم بگیری:
    credentials: backend.key === "reverb" ? "include" : "omit",
  });

  // ✅ args می‌تونه string باشه یا object. هیچ تغییری لازم نیست.
  // فقط endpoints باید در queryها استفاده شوند (پایین)
  return baseQuery(args, api, extraOptions);
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  tagTypes: ["Me", "Users", "Rooms", "Messages", "Friends", "Convos"],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => buildEndpoints(getBackend()).me,
      providesTags: ["Me"],
    }),

    getUsers: builder.query({
      query: () => buildEndpoints(getBackend()).users,
      providesTags: ["Users"],
    }),

    getRooms: builder.query({
      query: () => buildEndpoints(getBackend()).rooms,
      providesTags: ["Rooms"],
    }),

    getConversations: builder.query({
      query: () => buildEndpoints(getBackend()).convos,
      providesTags: ["Convos"],
    }),

    getRoomMessages: builder.query({
      query: (roomId) => buildEndpoints(getBackend()).roomMessages(roomId),
      providesTags: (res, err, roomId) => [{ type: "Messages", id: roomId }],
    }),

    sendMessage: builder.mutation({
      query: ({ roomId, content }) => ({
        url: buildEndpoints(getBackend()).roomMessages(roomId),
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (res, err, { roomId }) => [{ type: "Messages", id: roomId }, "Rooms"],
    }),

    sendFriendRequest: builder.mutation({
      query: ({ to_user_id }) => ({
        url: buildEndpoints(getBackend()).friend,
        method: "POST",
        body: { to_user_id },
      }),
      invalidatesTags: ["Friends"],
    }),

    respondFriendRequest: builder.mutation({
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
