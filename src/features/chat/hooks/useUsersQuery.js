import { useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  useGetUsersQuery,
  useSendFriendRequestMutation,
  useRespondFriendRequestMutation,
} from '@/shared/api/apiSlice';

const normalizeUsers = (raw) =>
  Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : Array.isArray(raw?.data) ? raw.data : [];

const filterUsersByQuery = (users, query) => {
  const q = (query || '').toLowerCase();
  return users.filter((u) => {
    const name = u.first_name || u.firstName || u.name || u.email || '';
    return name.toLowerCase().includes(q);
  });
};

export function useUsersQuery({ bareToken, searchQuery, retryRooms }) {
  const usersQ = useGetUsersQuery(undefined, { skip: !bareToken });

  const [sendFriendRequest, sendFriendReqState] = useSendFriendRequestMutation();
  const [respondFriendRequest, respondFriendReqState] = useRespondFriendRequestMutation();

  const allUsers = useMemo(() => normalizeUsers(usersQ.data), [usersQ.data]);
  const filteredUsers = useMemo(
    () => filterUsersByQuery(allUsers, searchQuery),
    [allUsers, searchQuery],
  );

  const handleFriendshipRequest = useCallback(
    async (userId) => {
      if (!userId) return;
      if (!bareToken) return toast.error('You must be logged in to add friends');

      try {
        const res = await sendFriendRequest({ to_user_id: userId }).unwrap();
        toast.success(res?.message || 'Friendship request sent!');
        usersQ.refetch?.();
        retryRooms?.();
      } catch (err) {
        toast.error(err?.data?.message || err?.data?.error || err?.error || 'Error sending friendship request');
      }
    },
    [bareToken, sendFriendRequest, usersQ, retryRooms],
  );

  const handleRespondFriendRequest = useCallback(
    async ({ friendshipId, action }) => {
      if (!friendshipId || !action) return;
      if (!bareToken) return toast.error('You must be logged in');

      try {
        const res = await respondFriendRequest({ friendship_id: friendshipId, action }).unwrap();
        toast.success(res?.message || 'Friend request updated');
        usersQ.refetch?.();
        retryRooms?.();
      } catch (err) {
        toast.error(err?.data?.message || err?.data?.error || err?.error || 'Error updating friend request');
      }
    },
    [bareToken, respondFriendRequest, usersQ, retryRooms],
  );

  return {
    usersQ,
    filteredUsers,
    sendFriendReqState,
    respondFriendReqState,
    handleFriendshipRequest,
    handleRespondFriendRequest,
  };
}

