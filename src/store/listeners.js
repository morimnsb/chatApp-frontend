// src/store/listeners.js
import { createListenerMiddleware } from '@reduxjs/toolkit';

import {
  loginThunk,
  logoutThunk,
  refreshThunk,
  localLogout,
  selectIsTokenExpired,
  selectRefreshToken,
} from '@/store/authSlice';

import { apiSlice } from '@/services/apiSlice';
import { wsConnected, wsDisconnected } from '@/store/wsActions';

const listenerMiddleware = createListenerMiddleware();

/**
 * 1) مدیریت WebSocket بر اساس وضعیت احراز هویت
 * --------------------------------------------------
 */

// وقتی login موفق شد → WS را وصل کن
listenerMiddleware.startListening({
  actionCreator: loginThunk.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(wsConnected());
  },
});

// وقتی logoutThunk موفق شد → WS را قطع کن
listenerMiddleware.startListening({
  actionCreator: logoutThunk.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(wsDisconnected());
  },
});

// اگر login رد شد (مثلاً پسورد اشتباه) → مطمئن شو WS قطع است
listenerMiddleware.startListening({
  actionCreator: loginThunk.rejected,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(wsDisconnected());
  },
});

/**
 * 2) Auto-refresh توکن قبل از callهای مهم RTK Query
 * --------------------------------------------------
 *
 * این‌بار به‌جای matcher از predicate استفاده می‌کنیم تا کاملاً کنترل دست خودمان باشد.
 */

const protectedEndpoints = new Set([
  'getMe',
  'getUsers',
  'getRooms', // اگر در apiSlice اسمش getConversations است، اینجا را همسان کن
  'getRoomMessages',
  'sendMessage',
]);

listenerMiddleware.startListening({
  // predicate خودش یک تابع ساده است: (action, currentState, prevState) => boolean
  predicate: (action, currentState, previousState) => {
    // فقط actionهای RTK Query برای apiSlice
    // معمولا نوعش چیزی مثل 'api/executeQuery/pending' یا شبیه اینه
    if (
      action.type !== `${apiSlice.reducerPath}/executeQuery/pending` &&
      action.type !== `${apiSlice.reducerPath}/executeMutation/pending`
    ) {
      return false;
    }

    const endpointName = action.meta?.arg?.endpointName;
    if (!endpointName) return false;

    // فقط endpointهای محافظت‌شده که نیاز به توکن دارند
    return protectedEndpoints.has(endpointName);
  },

  effect: async (action, listenerApi) => {
    const state = listenerApi.getState();

    const isExpired = selectIsTokenExpired(state);
    const refreshToken = selectRefreshToken(state);

    // اگر refreshToken نداریم یا هنوز منقضی نشده، کاری نکن
    if (!refreshToken || !isExpired) return;

    // تلاش برای رفرش
    const res = await listenerApi.dispatch(refreshThunk());

    // اگر رفرش هم شکست خورد → لاگ‌اوت کامل + قطع WS
    if (refreshThunk.rejected.match(res)) {
      listenerApi.dispatch(localLogout());
      listenerApi.dispatch(wsDisconnected());
    }
  },
});

export default listenerMiddleware;
