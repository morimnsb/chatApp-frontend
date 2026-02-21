// src/app/AuthBootstrap.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  meThunk,
  markBootstrapped,
  selectBootstrapped,
  selectAccessToken,
} from '@/app/store/authSlice';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[AuthBootstrap]', ...a);

export default function AuthBootstrap() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  // ✅ استاندارد: همون access_token
  const accessToken = useSelector(selectAccessToken);

  const didRunRef = useRef(false);

  useEffect(() => {
    // اگر قبلاً بوت‌استرپ انجام شده، هیچ
    if (bootstrapped) return;

    // StrictMode / double-invoke guard
    if (didRunRef.current) return;
    didRunRef.current = true;

    // توکن نداریم → بوت‌استرپ کامل
    if (!accessToken) {
      log('no token -> markBootstrapped');
      dispatch(markBootstrapped());
      return;
    }

    // توکن داریم → /me بزن تا currentUser پر بشه
    (async () => {
      try {
        log('token exists -> meThunk');
        await dispatch(meThunk()).unwrap();
        log('meThunk ok');
      } catch (e) {
        // توکن ممکنه invalid/expired باشه
        log('meThunk failed -> still markBootstrapped', e?.message || e);
      } finally {
        // ✅ در هر حالت ProtectedRoute گیر نکنه
        dispatch(markBootstrapped());
      }
    })();
  }, [dispatch, bootstrapped, accessToken]);

  return null;
}