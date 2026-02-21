// src/app/routes/AppRouter.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/shared/components";
import { ChatRealtimeLayout } from "@/features/chat/providers";
import BackendGate from "@/shared/components/BackendGate";

const HomeChat = lazy(() => import("@/features/chat/components/HomeChat"));
const RegisterForm = lazy(() => import("@/features/auth/components/RegisterForm"));
const VerifyEmail = lazy(() => import("@/features/auth/components/VerifyEmail"));
const ForgotPasswordForm = lazy(() => import("@/features/auth/components/ForgotPasswordForm"));
const ResetPasswordForm = lazy(() => import("@/features/auth/components/ResetPasswordForm"));
const ChangePasswordForm = lazy(() => import("@/features/auth/components/ChangePasswordForm"));
const LoginForm = lazy(() => import("@/features/auth/components/LoginForm"));
const ChooseBackendPage = lazy(() => import("@/features/system/pages/ChooseBackendPage"));

function PageFallback() {
  return <div style={{ padding: 16 }}>Loading...</div>;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/choose-backend" element={<ChooseBackendPage />} />

        <Route
          path="/*"
          element={
            <BackendGate>
              {/* ✅ AuthBootstrap حذف شد (bootstrap فقط در AppProviders انجام می‌شود) */}
              <Routes>
                {/* public */}
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                <Route path="/reset-password" element={<ResetPasswordForm />} />

                {/* protected */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/change-password" element={<ChangePasswordForm />} />

                  {/* ✅ realtime فقط برای /chat */}
                  <Route element={<ChatRealtimeLayout />}>
                    <Route path="/chat" element={<HomeChat />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </BackendGate>
          }
        />
      </Routes>
    </Suspense>
  );
}