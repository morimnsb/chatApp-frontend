// src/app/providers/AppProviders.jsx
import React, { useEffect, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { store } from '@/app/store/store';
import {
  meThunk,
  selectAccessToken,
  selectBootstrapped,
  markBootstrapped,
} from '@/app/store/authSlice';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[BootstrapAuth]', ...a);

function BootstrapAuth({ children }) {
  const dispatch = useDispatch();
  const accessToken = useSelector(selectAccessToken);
  const bootstrapped = useSelector(selectBootstrapped);

  const didRunRef = useRef(false);

  useEffect(() => {
    if (bootstrapped) return;
    if (didRunRef.current) return;
    didRunRef.current = true;

    (async () => {
      try {
        if (!accessToken) {
          log('no token -> skip me');
          return;
        }
        log('token -> meThunk');
        await dispatch(meThunk()).unwrap();
        log('meThunk ok');
      } catch (e) {
        log('meThunk failed (ignore), still bootstrapping', e?.message || e);
      } finally {
        dispatch(markBootstrapped());
        log('bootstrapped ✅');
      }
    })();
  }, [dispatch, accessToken, bootstrapped]);

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