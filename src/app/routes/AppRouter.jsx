import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/shared/components';

const HomeChat = lazy(() => import('@/features/chat/components/HomeChat'));
const LoginForm = lazy(() => import('@/features/auth/components/LoginForm'));
const RegisterForm = lazy(() => import('@/features/auth/components/RegisterForm'));
const VerifyEmail = lazy(() => import('@/features/auth/components/VerifyEmail'));
const ForgotPasswordForm = lazy(() => import('@/features/auth/components/ForgotPasswordForm'));
const ResetPasswordForm = lazy(() => import('@/features/auth/components/ResetPasswordForm'));
const ChangePasswordForm = lazy(() => import('@/features/auth/components/ChangePasswordForm'));

function PageFallback() {
  return (
    <div style={{ padding: 16 }}>
      Loading...
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />

          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <HomeChat />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
