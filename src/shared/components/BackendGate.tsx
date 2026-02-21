// chatApp-frontend\src\shared\components\BackendGate.tsx
// chatApp-frontend/src/shared/components/BackendGate.tsx
import React, { type PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/app/store/hooks";

export default function BackendGate({ children }: PropsWithChildren) {
  const location = useLocation();
  const backendKey = useAppSelector((s) => s.backend?.key ?? null);

  // ✅ اگر خودِ صفحه انتخاب بک‌اند هستیم، هیچ ریدایرکت نکن
  if (location.pathname === "/choose-backend") {
    return <>{children}</>;
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

  return <>{children}</>;
}