// src/components/UserModal.js
import React, { memo } from 'react';
import { Modal, ListGroup, Spinner, Alert, Button } from 'react-bootstrap';

const errText = (e) => {
  if (!e) return null;
  if (typeof e === 'string') return e;
  if ('status' in e) return e.data?.message || e.error || `خطا در دریافت کاربران (status: ${e.status})`;
  return 'خطا در دریافت کاربران';
};

const uiByStatus = {
  accepted: { v: 'success', t: 'دوست هستید', dis: true },
  pending_outgoing: { v: 'outline-warning', t: 'در انتظار تأیید', dis: true },
  pending_incoming: { v: 'outline-warning', t: 'در انتظار پاسخ شما', dis: true },
  none: { v: 'outline-secondary', t: 'افزودن دوست', dis: false },
};

function UserModal({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers = [],
  currentUser,
  handleFriendshipRequest,
}) {
  const close = () => setShowUserDropdown(false);

  return (
    <Modal show={showUserDropdown} onHide={close}>
      <Modal.Header closeButton><Modal.Title>انتخاب کاربر</Modal.Title></Modal.Header>
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
                const id = u.id ?? u.pk;
                const name = u.first_name || u.firstName || u.name || u.email || `User #${id}`;
                const avatar = u.photo || u.profile_picture || u.avatar || '/images/default-avatar.png';

                const isSelf = id != null && currentUser?.id != null && Number(id) === Number(currentUser.id);
                const st = u.friendship_status || 'none';
                const { v, t, dis } = uiByStatus[st] || uiByStatus.none;

                return (
                  <ListGroup.Item
                    key={id}
                    as="div"
                    className="d-flex justify-content-between align-items-center"
                    style={{ cursor: isSelf ? 'not-allowed' : 'default', opacity: isSelf ? 0.6 : 1 }}
                  >
                    <div className="d-flex align-items-center">
                      <img src={avatar} alt={name} className="profile-img me-2" />
                      {name}
                      {isSelf && <span className="ms-2 text-muted">(شما)</span>}
                      {st === 'accepted' && !isSelf && <span className="ms-2 badge bg-success">دوست</span>}
                      {st === 'pending_outgoing' && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">در انتظار تأیید</span>
                      )}
                      {st === 'pending_incoming' && !isSelf && (
                        <span className="ms-2 badge bg-warning text-dark">درخواست دوستی دریافت شده</span>
                      )}
                    </div>

                    {!isSelf && (
                      <Button
                        variant={v}
                        disabled={dis}
                        onClick={() => {
                          if (st !== 'none') return;
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
