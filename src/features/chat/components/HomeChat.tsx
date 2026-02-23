// chatApp-frontend/src/features/chat/components/HomeChat.tsx
import React, { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";

import LogoutButton from "@/features/auth/components/LogoutButton.jsx";
import ChatWindow from "@/features/chat/components/ChatWindow.jsx";
import EmptyChatState from "@/features/chat/components/EmptyChatState";
import HomeSidebar from "@/features/chat/components/HomeSidebar";
import { useHomeChatModel } from "@/features/chat/hooks/useHomeChatModel";

import "./HomeChat.css";

export default function HomeChat() {
  const [q, setQ] = useState<string>("");
  const [rid, setRid] = useState<number | null>(null);

  const { sidebar, chat } = useHomeChatModel({ q, rid, setRid });

  return (
    <Container fluid className="messages-container">
      <Link to="/choose-backend" style={{ textDecoration: "underline" }}>
        Change backend
      </Link>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chat</h5>
        <LogoutButton />
      </div>

      <Row>
        <HomeSidebar q={q} setQ={setQ} m={sidebar} />

        <Col md={8}>
          {rid ? (
            <ChatWindow
              key={rid}
              roomId={rid}
              effectiveKind={chat.k}
              accessToken={chat.t}
              sendTyping={chat.sendTyping}
              registerIncoming={chat.registerIncoming}
            />
          ) : (
            <EmptyChatState />
          )}
        </Col>
      </Row>
    </Container>
  );
}