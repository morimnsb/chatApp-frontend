// chatApp-frontend/src/features/chat/components/HomeSidebar.tsx
import React from "react";
import { Col } from "react-bootstrap";

import Header from "@/shared/components/Header";
import ConversationList from "@/shared/components/ConversationList";
import type { HomeSidebarModel } from "@/features/chat/types/homeChat";

type Props = {
  q: string;
  setQ: React.Dispatch<React.SetStateAction<string>>;
  m: HomeSidebarModel;
};

export default function HomeSidebar({ q, setQ, m }: Props) {
  return (
    <Col md={4} className="messages-list">
      <Header
        searchQuery={q}
        setSearchQuery={setQ}
        usersQ={m.users.usersQ}
        currentUser={m.me}
        filteredUsers={m.users.filteredUsers}
        handleFriendshipRequest={m.users.handleFriendshipRequest}
      />

      <ConversationList
        filteredIndividualMessages={m.lists.dmListWithPresence}
        filteredGroupMessages={m.lists.groupList}
        handleSelectChat={m.setRid as any} // اگر ConversationList تایپ شده نیست، اینجا رو بعداً دقیق می‌کنیم
        selectedRoom={m.rid}
        typingIndicators={m.lists.typingIndicators}
        currentUser={m.me}
        onRespondFriendRequest={m.users.handleRespondFriendRequest}
        onlineUsers={m.lists.onlineUsers}
        effectiveKind={m.k}
        loading={m.lists.loading}
        error={m.lists.error}
        onRetry={m.retryAll}
      />
    </Col>
  );
}