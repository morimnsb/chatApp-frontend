// src/components/UserModal.js
import React, { memo } from 'react';
import { Modal, ListGroup, Spinner, Alert, Button } from 'react-bootstrap';

const UserModal = ({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers = [],
  currentUser,
  handleFriendshipRequest,
}) => {
  const handleModalClose = () => setShowUserDropdown(false);

  // تبدیل خطاهای RTK Query به متن قابل‌نمایش
  const renderUsersError = () => {
    if (!errorUsers) return null;

    if (typeof errorUsers === 'string') return errorUsers;

    if ('status' in errorUsers) {
      if (errorUsers.data?.message) return errorUsers.data.message;
      if (errorUsers.error) return String(errorUsers.error);
      return `خطا در دریافت کاربران (status: ${errorUsers.status})`;
    }

    return 'خطا در دریافت کاربران';
  };

  return (
    <Modal show={showUserDropdown} onHide={handleModalClose}>
      <Modal.Header closeButton>
        <Modal.Title>انتخاب کاربر</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loadingUsers ? (
          <Spinner animation="border" />
        ) : errorUsers ? (
          <Alert variant="danger">{renderUsersError()}</Alert>
        ) : (
          <ListGroup>
            {filteredUsers.length === 0 ? (
              <ListGroup.Item>کاربری موجود نیست</ListGroup.Item>
            ) : (
              filteredUsers.map((user) => {
                const userId = user.id ?? user.pk;
                const numericUserId =
                  userId != null ? Number(userId) : undefined;

                const displayName =
                  user.first_name ||
                  user.firstName ||
                  user.name ||
                  user.email ||
                  `User #${userId}`;

                const avatar =
                  user.photo ||
                  user.profile_picture ||
                  user.avatar ||
                  '/images/default-avatar.png';

                const isSelf =
                  currentUser?.id &&
                  numericUserId != null &&
                  numericUserId === Number(currentUser.id);

                // 👇 وضعیت دوستی که از بک‌اند همراه یوزر می‌آید
                const friendshipStatus = user.friendship_status || 'none';
                const isFriend = friendshipStatus === 'accepted';
                const isPendingOutgoing =
                  friendshipStatus === 'pending_outgoing';
                const isPendingIncoming =
                  friendshipStatus === 'pending_incoming';
                const isNone = friendshipStatus === 'none';

                // تنظیم ظاهر دکمه
                let buttonVariant = 'outline-secondary';
                let buttonLabel = 'افزودن دوست';
                let buttonDisabled = false;

                if (isFriend) {
                  buttonVariant = 'success';
                  buttonLabel = 'دوست هستید';
                  buttonDisabled = true;
                } else if (isPendingOutgoing) {
                  buttonVariant = 'outline-warning';
                  buttonLabel = 'در انتظار تأیید';
                  buttonDisabled = true;
                } else if (isPendingIncoming) {
                  buttonVariant = 'outline-warning';
                  buttonLabel = 'در انتظار پاسخ شما';
                  // بعداً می‌تونی این حالت رو فعال کنی برای «تأیید دوستی»
                  buttonDisabled = true;
                } else if (isNone) {
                  buttonVariant = 'outline-secondary';
                  buttonLabel = 'افزودن دوست';
                  buttonDisabled = false;
                }

                return (
                  <ListGroup.Item
                    key={userId}
                    as="div"
                    className="d-flex justify-content-between align-items-center"
                    style={{
                      cursor: isSelf ? 'not-allowed' : 'default',
                      opacity: isSelf ? 0.6 : 1,
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <img
                        src={avatar}
                        alt={displayName}
                        className="profile-img me-2"
                      />
                      {displayName}
                      {isSelf && <span className="ms-2 text-muted">(شما)</span>}
                      {isFriend && !isSelf && (
                        <span className="ms-2 badge bg-success">دوست</span>
                      )}
                      {isPendingOutgoing && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">
                          در انتظار تأیید
                        </span>
                      )}
                      {isPendingIncoming && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">
                          درخواست دوستی دریافت شده
                        </span>
                      )}
                    </div>

                    {/* فقط یک دکمه – همان برای افزودن / انتظار / دوست هستید */}
                    {!isSelf && (
                      <Button
                        variant={buttonVariant}
                        disabled={buttonDisabled}
                        onClick={() => {
                          if (!isNone) return; // فقط وقتی هنوز دوستی نداریم
                          handleFriendshipRequest(userId);
                          // می‌تونی بخوای مودال بسته بشه یا باز بمونه، سلیقه‌ای:
                          handleModalClose();
                        }}
                      >
                        {buttonLabel}
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
};

export default memo(UserModal);
