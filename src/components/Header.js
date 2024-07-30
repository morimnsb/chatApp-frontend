import React from 'react';
import { InputGroup, FormControl, Button, Dropdown } from 'react-bootstrap';
import Message from '../assets/images/message/message.png';

const Header = ({ searchQuery, setSearchQuery, setShowUserDropdown, totalFilteredMessages }) => (
  <div className="header-container">
    <div className="messages-header">
      <p>
        Messages <span className="message-count">{totalFilteredMessages}</span>
      </p>
    </div>
    <InputGroup className="search-input-group">
      <FormControl
        placeholder="Search"
        aria-label="Search"
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
          <Dropdown.Item href="#/action-1">Newest</Dropdown.Item>
          <Dropdown.Item href="#/action-2">Oldest</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
    <div className="all-messages">
      <img src={Message} className="message-img" alt="logo" />
      <p>ALL MESSAGES</p>
    </div>
  </div>
);

export default Header;
