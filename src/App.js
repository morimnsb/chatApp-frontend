// src/App.js
import React from 'react';
import { Provider } from 'react-redux';
import store from './store/store';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';

import Register from './components/RegisterForm/RegisterForm';
import VerifyEmail from './components/VerifyEmail/VerifyEmail';
import LoginPage from './components/auth/LoginForm';
import HomeChat from './components/HomeChat';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

export const AuthContext = React.createContext(null);

// همهٔ روت‌ها را با createBrowserRouter می‌سازیم (بدون <BrowserRouter/>)
const router = createBrowserRouter(
  [
    { path: '/register', element: React.createElement(Register) },
    { path: '/login', element: React.createElement(LoginPage) },
    { path: '/verify-email', element: React.createElement(VerifyEmail) },
    {
      element: React.createElement(ProtectedRoute),
      children: [{ path: '/', element: React.createElement(HomeChat) }],
    },
    {
      path: '*',
      element: React.createElement(Navigate, { to: '/login', replace: true }),
    },
  ],
  {
    // فلگ‌های v7 برای حذف هشدارها
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  },
);

function App() {
  return React.createElement(
    Provider,
    { store },
    React.createElement(RouterProvider, {
      router,
      // دوباره همین‌جا هم ست می‌کنیم تا اگر مسیر دیگری استفاده شد، هشدار نیاید
      future: { v7_startTransition: true, v7_relativeSplatPath: true },
    }),
  );
}

export default App;
