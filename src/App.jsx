// src/App.jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from '@/features/auth/components/LoginForm.jsx';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import { meThunk, selectBootstrapped } from '@/app/store/authSlice';

import useUserEvents from '@/features/chat/hooks/useUserEvents.js';

// ✅ NEW: global notify hook
import { useGlobalNotify } from '@/features/chat/hooks/useGlobalNotify.js';

// lazy pages
const Register = React.lazy(() => import('@/features/auth/components/RegisterForm.jsx'));
const VerifyEmail = React.lazy(() => import('@/features/auth/components/VerifyEmail.jsx'));
const ForgotPasswordForm = React.lazy(() => import('@/features/auth/components/ForgotPasswordForm.jsx'));
const ResetPasswordForm = React.lazy(() => import('@/features/auth/components/ResetPasswordForm.jsx'));
const HomeChat = React.lazy(() => import('@/features/chat/components/HomeChat.jsx'));
const ChangePasswordForm = React.lazy(() => import('@/features/auth/components/ChangePasswordForm.jsx'));

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>
      Loading might takes a few times
    </div>
  );
}

// selectors
const selectToken = (s) => s.auth?.token || s.auth?.access_token || null;
const selectCurrentUserId = (s) =>
  s.auth?.user?.id ??
  s.auth?.user?.user_id ??
  s.auth?.currentUser?.id ??
  s.auth?.currentUser?.user_id ??
  null;

const selectIsAuthed = (s) => Boolean(selectToken(s) && selectCurrentUserId(s));

function SmartFallback() {
  const isAuthed = useSelector(selectIsAuthed);
  return <Navigate to={isAuthed ? '/' : '/login'} replace />;
}

function RootRouter() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    dispatch(meThunk());
  }, [dispatch]);

  if (!bootstrapped) return <Splash />;

  return (
    <BrowserRouter>
      <React.Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeChat />} />
            <Route path="/change-password" element={<ChangePasswordForm />} />
          </Route>

          <Route path="*" element={<SmartFallback />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

function AppShell({ children }) {
  const bootstrapped = useSelector(selectBootstrapped);
  const token = useSelector(selectToken);
  const currentUserId = useSelector(selectCurrentUserId);

  const effectiveKind = useMemo(() => 'reverb', []);

  const shouldEnableUserEvents = Boolean(bootstrapped && token && currentUserId);

  // ✅ selectedRoomId برای جلوگیری از toast وقتی روم فعاله
  const selectedRoomId = useSelector(
    (s) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null
  );

  // ✅ این handler تنها جاییه که ConversationList رو آپدیت می‌کنه
  const handleGlobalNotify = useGlobalNotify({ selectedRoom: selectedRoomId });

  // ✅ useUserEvents فقط گوش میده و payload رو میده به global notify
  useUserEvents({
    effectiveKind,
    accessToken: shouldEnableUserEvents ? token : null,
    currentUserId: shouldEnableUserEvents ? currentUserId : null,
    selectedRoomId,
    onNotify: handleGlobalNotify, // ✅ مهم
  });

  return (
    <>
      {children}
      <ToastContainer position="top-right" newestOnTop limit={3} />
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












