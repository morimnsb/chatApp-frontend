// src/components/UserModal.js
import React, { memo } from 'react';
import { Modal, ListGroup, Spinner, Alert, Button } from 'react-bootstrap';
import useOpenOrCreatePrivateRoom from '../hooks/useOpenOrCreatePrivateRoom';

const UserModal = ({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers = [],
  currentUser,
  handleSelectChat,
  handleFriendshipRequest,
  endpoints,
  effectiveKind,
  accessToken,
}) => {
  const { openOrCreate, pending, lastError } = useOpenOrCreatePrivateRoom({
    endpoints,
    effectiveKind,
    accessToken,
    handleSelectChat,
  });

  const handleModalClose = () => setShowUserDropdown(false);

  const handleUserClick = async (userId) => {
    if (!userId) return;
    if (currentUser?.id && Number(userId) === Number(currentUser.id)) {
      // جلوگیری از DM به خود کاربر
      return;
    }
    await openOrCreate(userId, 'Hi! UserModal');
    handleModalClose();
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
          <Alert variant="danger">
            {errorUsers.message || 'خطا در دریافت کاربران'}
          </Alert>
        ) : lastError ? (
          <Alert variant="danger">{lastError.message}</Alert>
        ) : (
          <ListGroup>
            {filteredUsers.length === 0 ? (
              <ListGroup.Item>کاربری موجود نیست</ListGroup.Item>
            ) : (
              filteredUsers.map((user) => {
                const isSelf =
                  currentUser?.id && Number(user.id) === Number(currentUser.id);
                return (
                  <ListGroup.Item
                    key={user.id}
                    as="div"
                    onClick={() =>
                      !pending && !isSelf && handleUserClick(user.id)
                    }
                    className="d-flex justify-content-between align-items-center"
                    style={{
                      cursor: isSelf || pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.7 : 1,
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <img
                        src={user.photo || 'path/to/default/photo.png'}
                        alt={user.first_name || user.name || 'user'}
                        className="profile-img me-2"
                      />
                      {user.first_name || user.name || `User #${user.id}`}
                      {isSelf && <span className="ms-2 text-muted">(شما)</span>}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        disabled={pending || isSelf}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSelf) handleUserClick(user.id);
                        }}
                      >
                        {pending ? 'در حال ایجاد…' : 'پیام بده'}
                      </Button>
                      <Button
                        variant="outline-secondary"
                        disabled={pending || isSelf}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSelf) {
                            handleFriendshipRequest(user.id);
                            handleModalClose();
                          }
                        }}
                      >
                        افزودن دوست
                      </Button>
                    </div>
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
