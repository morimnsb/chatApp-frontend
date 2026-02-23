// chatApp-frontend\src\shared\components\Header.tsx
// chatApp-frontend/src/shared/components/Header.tsx
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { InputGroup, FormControl, Button, Dropdown } from "react-bootstrap";
import Message from "@/assets/images/message/message.png";
import UserModal from "@/shared/components/UserModal";

export type HeaderHandle = {
  resetSearch: () => void;
  toggleDropdown: () => void;
};

type Props = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;

  usersQ?: any;
  currentUser?: any;
  filteredUsers?: any[];

  handleFriendshipRequest: (userId: string | number) => void; // ✅ REQUIRED
};

// ✅ tiny local helper
const err = (e: any) =>
  !e
    ? undefined
    : typeof e === "string"
      ? { message: e }
      : {
          status: e?.status ?? e?.originalStatus,
          message:
            e?.data?.message ??
            e?.error ??
            e?.message ??
            (typeof e?.data === "string" ? e.data : undefined),
          data: typeof e?.data === "object" ? e.data : undefined,
        };

const Header = forwardRef<HeaderHandle, Props>(function Header(
  { searchQuery, setSearchQuery, usersQ, currentUser, filteredUsers, handleFriendshipRequest },
  ref
) {
  const [show, setShow] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      resetSearch: () => setSearchQuery(""),
      toggleDropdown: () => setShow((v) => !v),
    }),
    [setSearchQuery]
  );

  return (
    <div className="header-container">
      <div className="messages-header">
        <p>Messages</p>
      </div>

      <InputGroup className="search-input-group">
        <FormControl
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button
          variant="outline-secondary"
          className="add-button"
          onClick={() => setShow(true)}
        >
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

      {/* ✅ moved here */}
      <UserModal
        showUserDropdown={show}
        setShowUserDropdown={setShow}
        loadingUsers={usersQ?.isLoading}
        errorUsers={err(usersQ?.error)}
        currentUser={currentUser}
        filteredUsers={filteredUsers}
        handleFriendshipRequest={handleFriendshipRequest}
      />
    </div>
  );
});

export default Header;