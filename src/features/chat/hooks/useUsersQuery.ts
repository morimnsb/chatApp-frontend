// chatApp-frontend\src\features\chat\hooks\useUsersQuery.ts
import { useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import {
  useGetUsersQuery,
  useSendFriendRequestMutation,
  useRespondFriendRequestMutation,
} from "@/shared/api/apiSlice";

type Id = string | number;

export type UserLike = {
  id?: Id;
  user_id?: Id;
  first_name?: string;
  firstName?: string;
  name?: string;
  email?: string;
  [k: string]: any;
};

type UsersResponseShape =
  | UserLike[]
  | { results?: UserLike[] }
  | { data?: UserLike[] }
  | any;

type UseUsersQueryArgs = {
  bareToken: string | null | undefined;
  searchQuery?: string | null;
  retryRooms?: (() => void) | null;
};

type FriendRequestAction = "accept" | "reject" | "cancel" | "block" | string;

const normalizeUsers = (raw: UsersResponseShape): UserLike[] =>
  Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.results)
      ? raw.results
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

const filterUsersByQuery = (users: UserLike[], query: string | null | undefined): UserLike[] => {
  const q = String(query || "").toLowerCase();
  if (!q) return users;

  return users.filter((u) => {
    const name = u.first_name || u.firstName || u.name || u.email || "";
    return String(name).toLowerCase().includes(q);
  });
};

function coerceId(v: unknown): Id | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n;
}

export function useUsersQuery({ bareToken, searchQuery, retryRooms }: UseUsersQueryArgs) {
  const usersQ = useGetUsersQuery(undefined, { skip: !bareToken });

  const [sendFriendRequest, sendFriendReqState] = useSendFriendRequestMutation();
  const [respondFriendRequest, respondFriendReqState] = useRespondFriendRequestMutation();

  const allUsers = useMemo(() => normalizeUsers(usersQ.data as any), [usersQ.data]);

  const filteredUsers = useMemo(
    () => filterUsersByQuery(allUsers, searchQuery),
    [allUsers, searchQuery]
  );

  const handleFriendshipRequest = useCallback(
    async (userIdRaw: Id | null | undefined) => {
      const userId = coerceId(userIdRaw);
      if (!userId) return;

      if (!bareToken) {
        toast.error("You must be logged in to add friends");
        return;
      }

      try {
        const res = await sendFriendRequest({ to_user_id: userId }).unwrap();
        toast.success((res as any)?.message || "Friendship request sent!");
        usersQ.refetch?.();
        retryRooms?.();
      } catch (err: any) {
        toast.error(
          err?.data?.message ||
            err?.data?.error ||
            err?.error ||
            "Error sending friendship request"
        );
      }
    },
    [bareToken, sendFriendRequest, usersQ, retryRooms]
  );

  const handleRespondFriendRequest = useCallback(
    async ({
      friendshipId,
      action,
    }: {
      friendshipId: Id | null | undefined;
      action: FriendRequestAction | null | undefined;
    }) => {
      const fid = coerceId(friendshipId);
      if (!fid || !action) return;

      if (!bareToken) {
        toast.error("You must be logged in");
        return;
      }

      try {
        const res = await respondFriendRequest({
          friendship_id: fid,
          action,
        }).unwrap();

        toast.success((res as any)?.message || "Friend request updated");
        usersQ.refetch?.();
        retryRooms?.();
      } catch (err: any) {
        toast.error(
          err?.data?.message || err?.data?.error || err?.error || "Error updating friend request"
        );
      }
    },
    [bareToken, respondFriendRequest, usersQ, retryRooms]
  );

  return {
    usersQ,
    filteredUsers,
    sendFriendReqState,
    respondFriendReqState,
    handleFriendshipRequest,
    handleRespondFriendRequest,
  } as const;
}