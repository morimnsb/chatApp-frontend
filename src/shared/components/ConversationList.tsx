// chatApp-frontend\src\shared\components\ConversationList.tsx
import React, { useMemo, useState, useCallback } from "react";
import { ListGroup, Button, Spinner } from "react-bootstrap";
import { useSelector, shallowEqual } from "react-redux";

import type { RootState } from "@/app/store/store";
import type { BackendKey } from "@/shared/backend";

import { formatTime } from "@/shared/utils/formatTime";
import profilephoto1 from "@/assets/images/message/profilephoto1.png";
import "./ConversationList.css";

type Id = number | string;

type RespondArgs = {
  friendshipId: Id;
  action: "accept" | "reject" | string;
};

type Props = {
  filteredIndividualMessages: any[];
  filteredGroupMessages: any[];
  currentUser: any;

  handleSelectChat: (roomId: any, receiverId?: any) => any;
  selectedRoom: number | null;

  typingIndicators?: Record<string, boolean> | any;

  onRespondFriendRequest?: (args: RespondArgs) => Promise<any> | any;

  onlineUsers?: any[];

  // ✅ FIX: HomeChat passes this
  effectiveKind?: BackendKey;

  // ✅ NEW: status from Gate/HomeChat
  onRetry?: () => void;
  loading?: boolean;
  error?: any;
};

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[ConversationList]", ...a);

const safeArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const clip = (s: unknown, n = 38) => {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const getLastText = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v?.content || v?.message || v?.text || "";
};

const getRoomId = (c: any) => c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.id ?? null;

export default function ConversationList({
  filteredIndividualMessages,
  filteredGroupMessages,
  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,
  onlineUsers = [],
  effectiveKind, // ✅ accepted (may be unused)
  onRetry,
  loading = false,
  error = null,
}: Props) {
  // ✅ Redux fallback (props -> redux)
  const { storeDM, storeGRP } = useSelector(
    (state: RootState) => ({
      storeDM: (state as any).messages?.individualMessages || [],
      storeGRP: (state as any).messages?.groupMessages || [],
    }),
    shallowEqual
  );

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ✅ Presence -> Set for fast lookup
  const onlineSet = useMemo(() => {
    const s = new Set<string>();
    safeArr<any>(onlineUsers).forEach((u) => {
      if (u?.id != null) s.add(String(u.id));
    });
    return s;
  }, [onlineUsers]);

  // ✅ data source priority: props -> redux
  const individualMessages = useMemo(() => {
    const fromProps = safeArr<any>(filteredIndividualMessages);
    return fromProps.length ? fromProps : safeArr<any>(storeDM);
  }, [filteredIndividualMessages, storeDM]);

  const groupMessages = useMemo(() => {
    const fromProps = safeArr<any>(filteredGroupMessages);
    return fromProps.length ? fromProps : safeArr<any>(storeGRP);
  }, [filteredGroupMessages, storeGRP]);

  const renderTypingIndicator = useCallback(
    (userId: any) => (typingIndicators?.[userId] ? "is typing..." : null),
    [typingIndicators]
  );

  // ✅ We do NOT create group here anymore
  const handleCreateGroup = useCallback(async () => {
    setCreating(true);
    setCreateError(
      "Creating group is disabled here. Move it to HomeChat/useChatData and pass a handler prop."
    );
    log("create group blocked (no side-effects in ConversationList)", { effectiveKind });
    setCreating(false);
  }, [effectiveKind]);

  const showTopStatus = Boolean(loading || error);

  return (
    <ListGroup className="message-list-wrapper">
      {showTopStatus && (
        <ListGroup.Item className="list-group-header" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> <span>Loading…</span>
            </>
          ) : (
            <>
              <span style={{ color: "crimson" }}>Error:</span>
              <span style={{ fontSize: 12 }}>
                {typeof error === "string" ? error : error?.message || "Something went wrong"}
              </span>

              {onRetry && (
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => onRetry?.()}
                  style={{ marginLeft: "auto" }}
                >
                  Retry
                </Button>
              )}
            </>
          )}
        </ListGroup.Item>
      )}

      <ListGroup.Item disabled className="list-group-header">
        INDIVIDUAL MESSAGES
      </ListGroup.Item>

      {individualMessages.length > 0 ? (
        individualMessages.map((convo: any) => {
          const roomId = getRoomId(convo);
          const userId = convo?.partnerId ?? convo?.partner_id ?? convo?.user_id ?? null;

          const lastMsgObj = convo?.last_message_obj ?? convo?.last_message ?? null;
          const lastMsgText = getLastText(lastMsgObj) || convo?.last_message_text || "";

          const lastTime =
            convo?.last_message_at ||
            (typeof lastMsgObj === "object" ? lastMsgObj?.created_at || lastMsgObj?.timestamp : null) ||
            null;

          const displayName =
            convo?.first_name || convo?.firstName || convo?.name || convo?.email || `User #${userId ?? "?"}`;

          const avatar = convo?.photo || convo?.avatar || profilephoto1;
          const isActive = Number(selectedRoom) === Number(roomId);

          const friendshipStatus = convo?.friendship_status;
          const friendshipId = convo?.friendship_id;

          const isFriendReqIncoming = friendshipStatus === "pending_incoming";
          const isFriendReqOutgoing = friendshipStatus === "pending_outgoing";

          const isSelf =
            currentUser?.id && userId != null && Number(currentUser.id) === Number(userId);

          let subtitle = "";
          if (isFriendReqIncoming) subtitle = "sent you a friend request";
          else if (isFriendReqOutgoing) subtitle = "Friend request sent";
          else subtitle = clip(lastMsgText, 60);

          const inlinePreview = !isFriendReqIncoming && !isFriendReqOutgoing ? clip(lastMsgText, 28) : "";

          const isOnline = userId != null ? onlineSet.has(String(userId)) : false;

          return (
            <ListGroup.Item
              key={`dm-${roomId || userId || Math.random()}`}
              className={`message-list-item p-0 ${isActive ? "active" : ""}`}
            >
              <div
                role="button"
                tabIndex={0}
                className="message-row w-100"
                style={{ cursor: "pointer" }}
                onClick={() => handleSelectChat(roomId, userId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSelectChat(roomId, userId);
                }}
              >
                <div className="message-content">
                  <div className={`avatar-ring ${isOnline ? "ring-online" : "ring-offline"}`}>
                    <img src={avatar} alt={displayName} className="profile-img" />
                  </div>
                </div>

                <div className="message-body">
                  <div className="message-header">
                    <span className="user-name">
                      {displayName}{" "}
                      {isSelf && (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          (you)
                        </span>
                      )}

                      {inlinePreview ? (
                        <span className="text-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          · {inlinePreview}
                        </span>
                      ) : null}
                    </span>

                    <span className="time-text">{lastTime ? formatTime(lastTime) : ""}</span>
                  </div>

                  <div className="message-details">
                    {isFriendReqIncoming && friendshipId ? (
                      <div className="d-flex align-items-center gap-2 w-100">
                        <span className="subtext">{subtitle}</span>

                        {onRespondFriendRequest && (
                          <div className="d-flex gap-1 ms-auto">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({ friendshipId, action: "accept" });
                              }}
                            >
                              Accept
                            </Button>

                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({ friendshipId, action: "reject" });
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {renderTypingIndicator(userId) ? (
                          <span className="subtext">{renderTypingIndicator(userId)}</span>
                        ) : (
                          <span className="subtext">{subtitle}</span>
                        )}

                        {Number(convo?.unread_count || 0) > 0 && (
                          <span className="unread_count">{convo.unread_count}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })
      ) : (
        <ListGroup.Item className="no-messages">No individual messages available</ListGroup.Item>
      )}

      <ListGroup.Item className="list-group-header group-header-row">
        <span>GROUP MESSAGES</span>

        <Button
          variant="primary"
          size="sm"
          className="new-group-btn"
          onClick={handleCreateGroup}
          disabled={creating}
          title="Move create-group logic to HomeChat and pass a handler prop"
        >
          {creating ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />{" "}
              Creating...
            </>
          ) : (
            "+ New Group"
          )}
        </Button>
      </ListGroup.Item>

      {createError && (
        <ListGroup.Item className="create-error">
          <span style={{ color: "red", fontSize: "0.8rem" }}>{createError}</span>
        </ListGroup.Item>
      )}

      {groupMessages.length > 0 ? (
        groupMessages.map((room: any) => {
          const roomId = room?.id ?? null;

          const lastMsgObj = room?.last_message_obj ?? room?.last_message ?? null;
          const lastMsgText = getLastText(lastMsgObj) || room?.last_message_text || "";

          const lastTime = room?.last_message_at || lastMsgObj?.created_at || lastMsgObj?.timestamp || null;

          const name = room?.name || room?.title || room?.room_name || `Room #${roomId}`;
          const isActive = Number(selectedRoom) === Number(roomId);

          const inlinePreview = clip(lastMsgText, 28);

          return (
            <ListGroup.Item
              key={`group-${roomId}`}
              className={`message-list-item p-0 ${isActive ? "active" : ""}`}
            >
              <div
                role="button"
                tabIndex={0}
                className="message-row w-100"
                style={{ cursor: "pointer" }}
                onClick={() => handleSelectChat(roomId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSelectChat(roomId);
                }}
              >
                <div className="message-content">
                  <div className="avatar-ring ring-group">
                    <img src={room?.photo || profilephoto1} alt={name} className="profile-img" />
                  </div>
                </div>

                <div className="message-body">
                  <div className="message-header">
                    <span className="room-name">
                      {name}
                      {inlinePreview ? (
                        <span className="text-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          · {inlinePreview}
                        </span>
                      ) : null}
                    </span>

                    <span className="time-text">{lastTime ? formatTime(lastTime) : ""}</span>
                  </div>

                  <div className="message-details">
                    <span className="subtext">{clip(lastMsgText, 60)}</span>

                    {Number(room?.unread_count || 0) > 0 && (
                      <span className="unread_count">{room.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })
      ) : (
        <ListGroup.Item className="no-messages">No group messages available</ListGroup.Item>
      )}
    </ListGroup>
  );
}