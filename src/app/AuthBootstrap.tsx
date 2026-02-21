// chatApp-frontend\src\app\AuthBootstrap.tsx
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  meThunk,
  markBootstrapped,
  selectBootstrapped,
  selectAccessToken,
} from "@/app/store/authSlice";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[AuthBootstrap]", ...a);

export default function AuthBootstrap(): null {
  const dispatch = useAppDispatch();
  const bootstrapped = useAppSelector(selectBootstrapped);

  // ✅ استاندارد: همون access_token
  const accessToken = useAppSelector(selectAccessToken);

  const didRunRef = useRef(false);

  useEffect(() => {
    // اگر قبلاً بوت‌استرپ انجام شده، هیچ
    if (bootstrapped) return;

    // StrictMode / double-invoke guard
    if (didRunRef.current) return;
    didRunRef.current = true;

    // توکن نداریم → بوت‌استرپ کامل
    if (!accessToken) {
      log("no token -> markBootstrapped");
      dispatch(markBootstrapped());
      return;
    }

    // توکن داریم → /me بزن تا currentUser پر بشه
    (async () => {
      try {
        log("token exists -> meThunk");
        await dispatch(meThunk()).unwrap();
        log("meThunk ok");
      } catch (e: any) {
        // توکن ممکنه invalid/expired باشه
        log("meThunk failed -> still markBootstrapped", e?.message || e);
      } finally {
        // ✅ در هر حالت ProtectedRoute گیر نکنه
        dispatch(markBootstrapped());
      }
    })();
  }, [dispatch, bootstrapped, accessToken]);

  return null;
}