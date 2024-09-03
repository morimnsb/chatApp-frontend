import React, { memo } from 'react';
import { Modal, ListGroup, Spinner, Alert, Button } from 'react-bootstrap';
import useGenerateRoomId from '../hooks/useGenerateRoomId';

const UserModal = ({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers = [],
  currentUser,
  handleSelectChat,
  handleFriendshipRequest,
}) => {
  const generateRoomId = useGenerateRoomId(currentUser, handleSelectChat);

  const handleModalClose = () => setShowUserDropdown(false);

  const handleUserClick = (userId) => {
    generateRoomId(userId);
    handleModalClose(); // Close the modal after user selection
  };

  return (
    <Modal show={showUserDropdown} onHide={handleModalClose}>
      <Modal.Header closeButton>
        <Modal.Title>Select User</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loadingUsers ? (
          <Spinner animation="border" />
        ) : errorUsers ? (
          <Alert variant="danger">
            {errorUsers.message || 'An error occurred while fetching users'}
          </Alert>
        ) : (
          <ListGroup>
            {filteredUsers.length === 0 ? (
              <ListGroup.Item>No users available</ListGroup.Item>
            ) : (
              filteredUsers.map((user) => (
                <ListGroup.Item
                  key={user.id}
                  as="div"
                  onClick={() => handleUserClick(user.id)}
                  className="d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center">
                    <img
                      src={user.photo || 'path/to/default/photo.png'}
                      alt={user.first_name}
                      className="profile-img me-2"
                    />
                    {user.first_name}
                  </div>
                  <Button
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFriendshipRequest(user.id);
                      handleModalClose(); // Close the modal after adding a friend
                    }}
                  >
                    Add Friend
                  </Button>
                </ListGroup.Item>
              ))
            )}
          </ListGroup>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default memo(UserModal);
