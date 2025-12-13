// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import LoginPage from '@/components/auth/LoginForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { meThunk, selectBootstrapped } from '@/store/authSlice';

// 👇 هوک رویدادهای کاربر (کانال user.{id})
import useUserEvents from '@/hooks/useUserEvents';

// صفحات lazy
const Register = React.lazy(() =>
  import('@/components/RegisterForm/RegisterForm'),
);
const VerifyEmail = React.lazy(() =>
  import('@/components/VerifyEmail/VerifyEmail'),
);
const ForgotPasswordForm = React.lazy(() =>
  import('@/components/auth/ForgotPasswordForm'),
);
const ResetPasswordForm = React.lazy(() =>
  import('@/components/auth/ResetPasswordForm'),
);
const HomeChat = React.lazy(() => import('@/components/HomeChat'));
const ChangePasswordForm = React.lazy(() =>
  import('@/components/auth/ChangePasswordForm'),
);

// صفحه‌ی مشترک لودینگ
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

/**
 * این همون Router فعلی توست – دست نمی‌زنیم بهش
 */
function RootRouter() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  // فقط یک بار meThunk را صدا بزن (چک لاگین)
  useEffect(() => {
    dispatch(meThunk());
  }, [dispatch]);

  // تا وقتی meThunk تمام نشده → فقط Splash
  if (!bootstrapped) return <Splash />;

  return (
    <BrowserRouter>
      <React.Suspense fallback={<Splash />}>
        <Routes>
          {/* 🔓 صفحات عمومی */}
          <Route path="/login" element={<LoginPage />} />

          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />

          {/* 🔐 روت محافظت‌شده */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeChat />} />
            <Route path="/change-password" element={<ChangePasswordForm />} />
          </Route>

          {/* fallback برای مسیرهای اشتباه */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

/**
 * AppShell:
 *  - فقط کارهای "گلوبال" مثل WebSocket / Reverb / user events را مدیریت می‌کند
 *  - Router و بقیه‌ی UI را به عنوان children می‌گیرد
 *  - هر یوزر لاگین‌شده → یک اتصال Reverb و لیسنر روی user.{id}
 */
function AppShell({ children }) {
  // اینجا مستقیم از state.auth می‌گیریم تا گیر اسم selectorها نیفتیم
  const accessToken =
    useSelector(
      (state) => state.auth?.access_token || state.auth?.accessToken,
    ) || null;

  const currentUserId =
    useSelector((state) => state.auth?.currentUser?.id) || null;

  // فعلاً backend را reverb در نظر می‌گیریم (اگر سوئیچر داری، به‌جاش بذار)
  const effectiveKind = 'reverb';

  useUserEvents({
    effectiveKind,
    accessToken,
    currentUserId,
  });

  return <>{children}</>;
}

export default function App() {
  return (
    <AppShell>
      <RootRouter />
    </AppShell>
  );
}
