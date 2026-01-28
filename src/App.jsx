// src/App.jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from '@/components/auth/LoginForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { meThunk, selectBootstrapped } from '@/store/authSlice';

import useUserEvents from '@/hooks/useUserEvents';

// lazy pages
const Register = React.lazy(() => import('@/components/RegisterForm/RegisterForm'));
const VerifyEmail = React.lazy(() => import('@/components/VerifyEmail/VerifyEmail'));
const ForgotPasswordForm = React.lazy(() => import('@/components/auth/ForgotPasswordForm'));
const ResetPasswordForm = React.lazy(() => import('@/components/auth/ResetPasswordForm'));
const HomeChat = React.lazy(() => import('@/components/HomeChat/HomeChat'));
const ChangePasswordForm = React.lazy(() => import('@/components/auth/ChangePasswordForm'));

function Splash() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
      }}
    >
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

  // جلوگیری از دوبار dispatch در React 18 StrictMode (DEV)
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

          {/* fallback */}
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

  // اگر BackendPicker داری، بعداً از store بگیر
  const effectiveKind = useMemo(() => 'reverb', []);

  // فقط وقتی آماده‌ایم هوک رو فعال کن
  const shouldEnableUserEvents = Boolean(bootstrapped && token && currentUserId);

  const selectedRoomId = useSelector((s) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null);

useUserEvents({
  effectiveKind,
  accessToken: shouldEnableUserEvents ? token : null,
  currentUserId: shouldEnableUserEvents ? currentUserId : null,
  selectedRoomId,
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
