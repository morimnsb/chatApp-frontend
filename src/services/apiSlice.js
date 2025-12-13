// src/services/apiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

export const apiSlice = createApi({
  reducerPath: 'api',

  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Accept', 'application/json');
      return headers;
    },
    credentials: 'omit', // چون Bearer token داریم
  }),

  tagTypes: ['Me', 'Users', 'Rooms', 'Messages', 'Friends'],

  endpoints: (builder) => ({
    // --- Auth: me ---
    getMe: builder.query({
      // چون داخل api.php هست ⇒ آدرس واقعی: http://localhost:8000/api/auth/me
      query: () => '/api/auth/me',
      providesTags: ['Me'],
    }),

    // --- Users لیست کاربران ---
    getUsers: builder.query({
      query: () => '/api/auth/users',
      providesTags: ['Users'],
    }),

    // --- Rooms (اگه فعلاً لازم داری) ---
    getRooms: builder.query({
      // route لاراولت اگر بدون api نوشته شده باشه: Route::get('/chatMeetUp/chatrooms', ...)
      // آدرس نهایی: http://localhost:8000/api/chatMeetUp/chatrooms
      query: () => '/api/chatMeetUp/chatrooms',
      providesTags: ['Rooms'],
    }),

    getConversations: builder.query({
      query: () => '/chatMeetUp/conversations',
    }),

    // --- Messages در یک روم ---
    getRoomMessages: builder.query({
      // نهایی: /api/chatMeetUp/messages/:roomId
      query: (roomId) => `/api/chatMeetUp/messages/${roomId}`,
      providesTags: (res, err, roomId) => [{ type: 'Messages', id: roomId }],
    }),

    sendMessage: builder.mutation({
      query: ({ roomId, content }) => ({
        url: `/api/chatMeetUp/messages/${roomId}`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (res, err, { roomId }) => [
        { type: 'Messages', id: roomId },
        'Rooms',
      ],
    }),

    // ✅ Friendship request (اینجا مشکل بود)
    sendFriendRequest: builder.mutation({
      query: ({ to_user_id }) => ({
        // چون route لاراولت توی api.php هست: Route::post('/chatMeetUp/friendship', ...)
        // پس آدرس واقعی ⇒ /api/chatMeetUp/friendship
        url: '/api/chatMeetUp/friendship',
        method: 'POST',
        body: { to_user_id },
      }),
      invalidatesTags: ['Friends'],
    }),

    respondFriendRequest: builder.mutation({
      query: ({ friendship_id, action }) => ({
        url: '/api/chatMeetUp/friendship/respond',   // 👈 خیلی مهم
        method: 'POST',
        body: { friendship_id, action },
      }),
    }),
  }),
});

// ✅ همه‌ی hookها رو export کن
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
