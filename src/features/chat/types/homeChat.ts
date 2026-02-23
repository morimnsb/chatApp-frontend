// chatApp-frontend/src/features/chat/types/homeChat.ts
import type React from "react";
import type { SendTypingFn as ChatWindowSendTypingFn } from "@/features/chat/components/ChatWindow";

export type BackendKind = "reverb" | "node" | "django" | "none" | string;
export type UiBackendKind = "reverb" | "node" | "django" | undefined;

export type RoomId = number;

export interface CurrentUser {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  [k: string]: unknown;
}

export type RegisterIncomingFn = (...args: any[]) => any;

/** ✅ دقیقا همان چیزی که ChatWindow می‌خواهد */
export type SendTypingFn = ChatWindowSendTypingFn;

export interface UsersQueryLike {
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  refetch?: () => unknown;
  [k: string]: unknown;
}

export interface SidebarLists {
  dmListWithPresence: unknown[];
  groupList: unknown[];
  typingIndicators: Record<string, any>;
  onlineUsers: unknown[];
  loading?: boolean;
  error?: unknown;
}

export interface SidebarUsers {
  usersQ?: UsersQueryLike;
  filteredUsers: unknown[];
  handleFriendshipRequest: (...args: any[]) => any;
  handleRespondFriendRequest: (...args: any[]) => any;
}

export interface HomeSidebarModel {
  /** ✅ برای ConversationList باید محدود باشد */
  k: UiBackendKind;
  me: CurrentUser | null;
  rid: RoomId | null;
  setRid: React.Dispatch<React.SetStateAction<RoomId | null>>;
  lists: SidebarLists;
  users: SidebarUsers;
  retryAll: () => void;
}

export interface HomeChatPaneModel {
  /** ✅ ChatWindow string می‌خواهد */
  k: string;
  t: string | null;
  rid: RoomId | null;
  registerIncoming: RegisterIncomingFn;
  sendTyping: SendTypingFn;
}

export interface HomeChatModel {
  sidebar: HomeSidebarModel;
  chat: HomeChatPaneModel;
}