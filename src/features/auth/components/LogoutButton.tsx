// chatApp-frontend\src\features\auth\components\LogoutButton.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Spinner } from "react-bootstrap";

import { useAppDispatch } from "@/app/store/hooks";
import { logoutThunk, localLogout } from "@/app/store/authSlice";

export default function LogoutButton() {
  const [loading, setLoading] = useState<boolean>(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // ✅ now fully type-safe
      await dispatch(logoutThunk()).unwrap();
    } catch (err) {
      console.error("[LOGOUT ERROR]", err);
    } finally {
      dispatch(localLogout()); // همیشه
      setLoading(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <Button
      variant="outline-danger"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <>
          <Spinner animation="border" size="sm" className="me-1" />
          Logging out…
        </>
      ) : (
        "Logout"
      )}
    </Button>
  );
}