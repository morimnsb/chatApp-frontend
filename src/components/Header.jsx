// src/components/Header.jsx
import React, { forwardRef, useImperativeHandle } from 'react';
import { InputGroup, FormControl, Button, Dropdown } from 'react-bootstrap';
import Message from '@/assets/images/message/message.png';

const Header = forwardRef(({ searchQuery, setSearchQuery, setShowUserDropdown }, ref) => {
  useImperativeHandle(ref, () => ({
    resetSearch: () => setSearchQuery(''),
    toggleDropdown: () => setShowUserDropdown((v) => !v),
  }), [setSearchQuery, setShowUserDropdown]);

  return (
    <div className="header-container">
      <div className="messages-header"><p>Messages</p></div>

      <InputGroup className="search-input-group">
        <FormControl
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button variant="outline-secondary" className="add-button" onClick={() => setShowUserDropdown(true)}>
          +
        </Button>
      </InputGroup>

      <div className="message-sort-dropdown">
        <span>Sort by </span>
        <Dropdown>
          <Dropdown.Toggle variant="link" id="dropdown-basic" className="message-dropdown-toggle">
            Newest
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => {}}>Newest</Dropdown.Item>
            <Dropdown.Item onClick={() => {}}>Oldest</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <div className="all-messages">
        <img src={Message} className="message-img" alt="logo" />
        <p>ALL MESSAGES</p>
      </div>
    </div>
  );
});

export default Header;
