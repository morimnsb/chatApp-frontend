// src/components/ProtectedRoute.jsx
import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { selectIsLoggedIn, selectBootstrapped } from '@/store/authSlice';

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
  const isLoggedIn = useSelector(selectIsLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}
