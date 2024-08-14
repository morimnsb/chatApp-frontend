import React from 'react';
import { Modal, ListGroup, Spinner, Alert, Button } from 'react-bootstrap';

const UserModal = ({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers,
  handleUserSelect,
  handleFriendshipRequest, // Receive this prop
}) => (
  <Modal show={showUserDropdown} onHide={() => setShowUserDropdown(false)}>
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
          {filteredUsers.map((user) => (
            <ListGroup.Item
              key={user.id}
              action={false} // Disable the action prop to prevent it from being a button
              as="div" // Render as a div to avoid button nesting issues
              onClick={() => handleUserSelect(user)}
              className="d-flex justify-content-between align-items-center"
            >
              <div className="d-flex align-items-center">
                <img
                  src={user.photo}
                  alt={user.first_name}
                  className="profile-img me-2"
                />
                {user.first_name}
              </div>
              <Button
                variant="primary"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering handleUserSelect
                  handleFriendshipRequest(user.id);
                }}
              >
                Add Friend
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Modal.Body>
  </Modal>
);

export default UserModal;
