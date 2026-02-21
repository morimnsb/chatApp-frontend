//chatApp-frontend\src\shared\components\UserModal.tsx
import React, { memo } from "react";
import { Modal, ListGroup, Spinner, Alert, Button } from "react-bootstrap";

type ApiErrorLike =
  | string
  | null
  | undefined
  | {
      status?: number;
      data?: { message?: string };
      error?: string;
      message?: string;
      detail?: string;
      [k: string]: any;
    };

type FriendshipStatus = "accepted" | "pending_outgoing" | "pending_incoming" | "none" | string;

type UserLike = {
  id?: number | string | null;
  pk?: number | string | null;
  email?: string | null;
  name?: string | null;

  first_name?: string | null;
  firstName?: string | null;

  photo?: string | null;
  profile_picture?: string | null;
  avatar?: string | null;

  friendship_status?: FriendshipStatus | null;

  [k: string]: any;
};

type CurrentUserLike = {
  id?: number | string | null;
  [k: string]: any;
};

type Props = {
  showUserDropdown: boolean;
  setShowUserDropdown: (v: boolean) => void;

  loadingUsers: boolean;
  errorUsers: ApiErrorLike;

  filteredUsers?: UserLike[];
  currentUser?: CurrentUserLike | null;

  handleFriendshipRequest: (userId: number | string) => void;
};

const errText = (e: ApiErrorLike): string | null => {
  if (!e) return null;
  if (typeof e === "string") return e;

  // RTK Query style: { status, data, error }
  if (typeof e === "object" && e && "status" in e) {
    return (
      (e as any)?.data?.message ||
      (e as any)?.error ||
      `خطا در دریافت کاربران (status: ${(e as any)?.status})`
    );
  }

  return (e as any)?.message || (e as any)?.detail || "خطا در دریافت کاربران";
};

const uiByStatus: Record<
  string,
  { v: React.ComponentProps<typeof Button>["variant"]; t: string; dis: boolean }
> = {
  accepted: { v: "success", t: "دوست هستید", dis: true },
  pending_outgoing: { v: "outline-warning", t: "در انتظار تأیید", dis: true },
  pending_incoming: { v: "outline-warning", t: "در انتظار پاسخ شما", dis: true },
  none: { v: "outline-secondary", t: "افزودن دوست", dis: false },
};

function UserModal({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers = [],
  currentUser,
  handleFriendshipRequest,
}: Props) {
  const close = () => setShowUserDropdown(false);

  return (
    <Modal show={showUserDropdown} onHide={close}>
      <Modal.Header closeButton>
        <Modal.Title>انتخاب کاربر</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loadingUsers ? (
          <Spinner animation="border" />
        ) : errorUsers ? (
          <Alert variant="danger">{errText(errorUsers)}</Alert>
        ) : (
          <ListGroup>
            {filteredUsers.length === 0 ? (
              <ListGroup.Item>کاربری موجود نیست</ListGroup.Item>
            ) : (
              filteredUsers.map((u) => {
                const id = (u.id ?? u.pk) as number | string | null | undefined;

                const name =
                  u.first_name ||
                  u.firstName ||
                  u.name ||
                  u.email ||
                  `User #${id ?? "?"}`;

                const avatar =
                  u.photo ||
                  u.profile_picture ||
                  u.avatar ||
                  "/images/default-avatar.png";

                const isSelf =
                  id != null &&
                  currentUser?.id != null &&
                  Number(id) === Number(currentUser.id);

                const st = (u.friendship_status || "none") as FriendshipStatus;
                const { v, t, dis } = uiByStatus[String(st)] || uiByStatus.none;

                return (
                  <ListGroup.Item
                    key={String(id ?? name)}
                    as="div"
                    className="d-flex justify-content-between align-items-center"
                    style={{
                      cursor: isSelf ? "not-allowed" : "default",
                      opacity: isSelf ? 0.6 : 1,
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <img src={avatar} alt={name} className="profile-img me-2" />
                      {name}
                      {isSelf && <span className="ms-2 text-muted">(شما)</span>}

                      {st === "accepted" && !isSelf && (
                        <span className="ms-2 badge bg-success">دوست</span>
                      )}
                      {st === "pending_outgoing" && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">
                          در انتظار تأیید
                        </span>
                      )}
                      {st === "pending_incoming" && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">
                          درخواست دوستی دریافت شده
                        </span>
                      )}
                    </div>

                    {!isSelf && (
                      <Button
                        variant={v}
                        disabled={dis}
                        onClick={() => {
                          if (st !== "none") return;
                          if (id == null) return;
                          handleFriendshipRequest(id);
                          close();
                        }}
                      >
                        {t}
                      </Button>
                    )}
                  </ListGroup.Item>
                );
              })
            )}
          </ListGroup>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default memo(UserModal);