// src/services/apiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { buildEndpoints, getChosenBackend } from '@/shared/backend/choice';

/**
 * baseQuery پویا:
 * هر request با توجه به backendChoice، baseUrl جدید می‌گیرد
 */
const dynamicBaseQuery = async (args, api, extraOptions) => {
  const kind = getChosenBackend(); // از localStorage
  const endpoints = buildEndpoints(kind);

  const rawBase = endpoints?.base || 'http://localhost:8000/api';
  const baseUrl = rawBase.replace(/\/+$/, '');

  const baseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json');
      return headers;
    },
    credentials: 'omit',
  });

  return baseQuery(args, api, extraOptions);
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: dynamicBaseQuery,
  tagTypes: ['Me', 'Users', 'Rooms', 'Messages', 'Friends', 'Convos'],
  endpoints: (builder) => ({
    // -----------------
    // Auth / Me
    // -----------------
    getMe: builder.query({
      // ✅ دیگر "/api" را اینجا نمی‌زنیم؛ buildEndpoints base را درست می‌دهد
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),

    // -----------------
    // Users
    // -----------------
    getUsers: builder.query({
      query: () => '/auth/users',
      providesTags: ['Users'],
    }),

    // -----------------
    // Rooms
    // -----------------
    getRooms: builder.query({
      query: () => '/chatMeetUp/chatrooms',
      providesTags: ['Rooms'],
    }),

    // -----------------
    // Conversations
    // -----------------
    getConversations: builder.query({
      query: () => '/chatMeetUp/conversations',
      providesTags: ['Convos'],
    }),

    // -----------------
    // Messages
    // -----------------
    getRoomMessages: builder.query({
      query: (roomId) => `/chatMeetUp/messages/${roomId}`,
      providesTags: (res, err, roomId) => [{ type: 'Messages', id: roomId }],
    }),

    sendMessage: builder.mutation({
      query: ({ roomId, content }) => ({
        url: `/chatMeetUp/messages/${roomId}`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (res, err, { roomId }) => [
        { type: 'Messages', id: roomId },
        'Rooms',
      ],
    }),

    // -----------------
    // Friendship
    // -----------------
    sendFriendRequest: builder.mutation({
      query: ({ to_user_id }) => ({
        url: '/chatMeetUp/friendship',
        method: 'POST',
        body: { to_user_id },
      }),
      invalidatesTags: ['Friends'],
    }),

    respondFriendRequest: builder.mutation({
      query: ({ friendship_id, action }) => ({
        url: '/chatMeetUp/friendship/respond',
        method: 'POST',
        body: { friendship_id, action },
      }),
      invalidatesTags: ['Friends'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetUsersQuery,
  useGetRoomsQuery,
  useGetRoomMessagesQuery,
  useSendMessageMutation,
  useSendFriendRequestMutation,
  useGetConversationsQuery,
  useRespondFriendRequestMutation,
} = apiSlice;

