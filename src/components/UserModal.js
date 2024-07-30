import React from 'react';
import { Modal, ListGroup, Spinner, Alert } from 'react-bootstrap';

const UserModal = ({
  showUserDropdown,
  setShowUserDropdown,
  loadingUsers,
  errorUsers,
  filteredUsers,
  handleUserSelect,
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
              action
              onClick={() => handleUserSelect(user)}
            >
              <img
                src={user.photo}
                alt={user.first_name}
                className="profile-img"
              />
              {user.first_name}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Modal.Body>
  </Modal>
);

export default UserModal;
