// src/shared/components/BackendGate.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function BackendGate({ children }) {
  const location = useLocation();
  const backendKey = useSelector((s) => s.backend?.key || null);

  // ✅ اگر خودِ صفحه انتخاب بک‌اند هستیم، هیچ ریدایرکت نکن
  if (location.pathname === "/choose-backend") {
    return children;
  }

  if (!backendKey) {
    return (
      <Navigate
        to="/choose-backend"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
