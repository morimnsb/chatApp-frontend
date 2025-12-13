// src/store/store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

// reducers
import authReducer from '@/store/authSlice';
import messagesEntityReducer from '@/store/messageEntitySlice';
import messageReducer from '@/reducers/messageReducer';

// آموزشی‌ها / پیشرفته‌ها
import listenerMiddleware from '@/store/listeners';
import wsReducer from '@/store/wsReducer';
import { apiSlice } from '@/services/apiSlice';
import wsMiddleware from '@/store/wsMiddleware';

// ---------- ENV ----------
const IS_PROD = import.meta.env.PROD === true;

// ---------- Root Reducer (برای HMR و ساختار تمیز) ----------

const makeRootReducer = () =>
  combineReducers({
    auth: authReducer,

    // legacy reducer (قدیمی‌تر)
    messages: messageReducer,

    // WebSocket state (isConnected, lastPacket, ...)
    ws: wsReducer,

    // RTK Query slice
    [apiSlice.reducerPath]: apiSlice.reducer,

    // ✅ اسلایس جدید entity-based
    messagesEntity: messagesEntityReducer,
  });

const rootReducer = makeRootReducer();

// ---------- Dev-only Logger Middleware (بدون لایبرری) ----------
const devLoggerMiddleware = (storeAPI) => (next) => (action) => {
  if (IS_PROD) return next(action);

  const startedAt = performance.now();
  const result = next(action);
  const endedAt = performance.now();

  // فقط اکشن‌های مهم رو چاپ کن (آموزشی)
  const type = action.type || '';
  const isAuth = type.startsWith('auth/');
  const isWs = type.startsWith('ws/');
  const isApi = type.startsWith(apiSlice.reducerPath + '/');

  if (isAuth || isWs || isApi) {
    // eslint-disable-next-line no-console
    console.log(`%c[REDUX] ${type}`, 'color:#7dd3fc;font-weight:bold;', {
      payload: action.payload,
      ms: (endedAt - startedAt).toFixed(1),
      stateSnapshot: storeAPI.getState(),
    });
  }

  return result;
};

// ---------- Store ----------

export const store = configureStore({
  reducer: rootReducer,

  // ⚠️ دیگه اینجا preloadedState نمی‌ذاریم
  // چون خود authSlice از localStorage هیدراته می‌کند.
  // اگر بعداً برای sliceهای دیگر هم Hydration خواستی،
  // بهتره هر کدوم داخل slice خودش انجام دهد.

  middleware: (getDefaultMiddleware) => {
    const defaults = getDefaultMiddleware({
      thunk: true,

      immutableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredPaths: [
              'messages.items',
              'messages.groups',
              'messages.individual',
              'ws.lastPacket',
              apiSlice.reducerPath,

              // ✅ اگر بعداً چیز non-serializable تو messagesEntity بذاری
              'messagesEntity',
            ],
          },

      serializableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredActions: [
              // legacy messages ممکنه payloadهای غیرسریالایزبل داشته باشه
              'messages/updateMessages',
              'messages/setGroupMessages',
              'messages/setIndividualMessages',

              // RTK Query actions (برای اطمینان آموزشی)
              `${apiSlice.reducerPath}/executeQuery/pending`,
              `${apiSlice.reducerPath}/executeQuery/fulfilled`,
              `${apiSlice.reducerPath}/executeQuery/rejected`,
              `${apiSlice.reducerPath}/executeMutation/pending`,
              `${apiSlice.reducerPath}/executeMutation/fulfilled`,
              `${apiSlice.reducerPath}/executeMutation/rejected`,
            ],
            ignoredPaths: [
              'messages.ids',
              'messages.entities',
              'ws.lastPacket',
              apiSlice.reducerPath,
            ],
          },
    });

    // pipeline مرتب:
    return defaults
      .concat(listenerMiddleware.middleware) // 1) listener
      .concat(apiSlice.middleware) // 2) RTK Query
      .concat(wsMiddleware) // 3) WebSocket middleware واقعی
      .concat(devLoggerMiddleware); // 4) logger آموزشی
  },

  devTools: !IS_PROD,

  // enhancers آموزشی (فعلاً خالی، آماده برای آینده)
  enhancers: (getDefaultEnhancers) => {
    const enh = getDefaultEnhancers();
    return enh;
  },
});

// ✅ RTK Query: enable refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

// ---------- HMR برای Vite ----------
if (!IS_PROD && import.meta.hot) {
  import.meta.hot.accept(
    [
      '@/store/authSlice',
      '@/reducers/messageReducer',
      '@/store/wsReducer',
      '@/store/messageEntitySlice',
      '@/services/apiSlice',
    ],
    () => {
      // در HMR، rootReducer جدید بساز و روی store ست کن
      const nextRootReducer = makeRootReducer();
      store.replaceReducer(nextRootReducer);
    },
  );
}

export default store;
