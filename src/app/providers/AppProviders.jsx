// src/app/providers/AppProviders.jsx
import React, { useEffect, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { store } from '@/app/store/store';
import {
  meThunk,
  selectToken,
  selectBootstrapped,
  markBootstrapped, // ✅ FIX: این import لازم بود
} from '@/app/store/authSlice';

// ✅ فقط auth bootstrap. هیچ ProtectedRoute اینجا نباشد.
function BootstrapAuth({ children }) {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const bootstrapped = useSelector(selectBootstrapped);

  // ✅ جلوگیری از دوبار اجرا در React StrictMode (dev)
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    if (bootstrapped) return;

    didRunRef.current = true;

    const finish = () => {
      try {
        dispatch(markBootstrapped());
      } catch {
        // اگر اکشن تعریف نشده بود، حداقل اپ کرش نکند
      }
    };

    if (token) {
      // ✅ حتی اگر meThunk fail شد، باید bootstrapped بشیم
      Promise.resolve(dispatch(meThunk()))
        .catch(() => {})
        .finally(finish);
    } else {
      finish();
    }
  }, [bootstrapped, token, dispatch]);

  return <>{children}</>;
}

export default function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <BootstrapAuth>{children}</BootstrapAuth>
      <ToastContainer position="top-right" autoClose={2500} newestOnTop />
    </Provider>
  );
}
