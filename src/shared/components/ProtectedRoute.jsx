// chatApp-frontend\src\shared\components\ProtectedRoute.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { selectIsLoggedIn, selectBootstrapped } from '@/app/store/authSlice';

function FullscreenSplash() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
      }}
    >
      Loading…
    </div>
  );
}

export default function ProtectedRoute() {
  const bootstrapped = useSelector(selectBootstrapped);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  if (!bootstrapped) return <FullscreenSplash />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}
