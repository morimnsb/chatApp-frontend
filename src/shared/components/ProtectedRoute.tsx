// src/shared/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectBootstrapped, selectIsLoggedIn } from "@/app/store/authSlice";

function ProtectedRoute() {
  const bootstrapped = useSelector(selectBootstrapped);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const loc = useLocation();

  if (!bootstrapped) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute; // ✅ این خط مهمه