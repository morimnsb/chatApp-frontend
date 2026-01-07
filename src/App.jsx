// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from '@/components/auth/LoginForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { meThunk, selectBootstrapped } from '@/store/authSlice';

// 👇 هوک رویدادهای کاربر (کانال user.{id})
import useUserEvents from '@/hooks/useUserEvents';

// صفحات lazy
const Register = React.lazy(() => import('@/components/RegisterForm/RegisterForm'));
const VerifyEmail = React.lazy(() => import('@/components/VerifyEmail/VerifyEmail'));
const ForgotPasswordForm = React.lazy(() => import('@/components/auth/ForgotPasswordForm'));
const ResetPasswordForm = React.lazy(() => import('@/components/auth/ResetPasswordForm'));
const HomeChat = React.lazy(() => import('@/components/HomeChat/HomeChat'));
const ChangePasswordForm = React.lazy(() => import('@/components/auth/ChangePasswordForm'));

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>
      Loading might takes a few times
    </div>
  );
}

function RootRouter() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  useEffect(() => {
    dispatch(meThunk());
  }, [dispatch]);

  if (!bootstrapped) return <Splash />;

  return (
    <BrowserRouter>
      <React.Suspense fallback={<Splash />}>
        <Routes>
          {/* public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />

          {/* protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeChat />} />
            <Route path="/change-password" element={<ChangePasswordForm />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

function AppShell({ children }) {
  // ✅ سازگار با authSlice فعلی تو (token + user)
  const token = useSelector((s) => s.auth?.token) || null;
  const currentUserId =
    useSelector((s) => s.auth?.user?.id ?? s.auth?.user?.user_id ?? s.auth?.currentUser?.id) || null;

  const effectiveKind = 'reverb';

  useUserEvents({ effectiveKind, accessToken: token, currentUserId });

  return (
    <>
      {children}

      {/* ✅ فقط یکبار در کل اپ */}
      <ToastContainer position="bottom-right" newestOnTop limit={3} />
    </>
  );
}

export default function App() {
  return (
    <AppShell>
      <RootRouter />
    </AppShell>
  );
}
