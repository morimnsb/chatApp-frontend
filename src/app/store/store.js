// src/store/store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

// reducers
import authReducer from '@/app/store/authSlice';
import messagesEntityReducer from '@/app/store/messageEntitySlice';
import messageReducer from '@/features/chat/state/messageReducer';

// advanced
import listenerMiddleware from '@/app/store/listeners';
import wsReducer from '@/app/store/wsReducer';
import { apiSlice } from '@/shared/api/apiSlice';
import wsMiddleware from '@/app/store/wsMiddleware';

// ---------- ENV ----------
const IS_PROD = import.meta.env.PROD === true;

// ✅ logger is OPT-IN (default OFF)
const DEV = import.meta.env.DEV === true;
const REDUX_LOG = DEV && String(import.meta.env.VITE_REDUX_LOG || '') === 'true';

// RTK Query noisy actions (we usually don't want to log them)
const NOISY_PREFIXES = [
  `${apiSlice.reducerPath}/internalSubscriptions/`,
  `${apiSlice.reducerPath}/executeQuery/`,
  `${apiSlice.reducerPath}/executeMutation/`,
  `${apiSlice.reducerPath}/config/`,
];

// ---------- Root Reducer ----------
const createRootReducer = () =>
  combineReducers({
    auth: authReducer,

    // messages reducer (classic)
    messages: messageReducer,

    // WebSocket state
    ws: wsReducer,

    // RTK Query slice
    [apiSlice.reducerPath]: apiSlice.reducer,

    // entity-based slice
    messagesEntity: messagesEntityReducer,
  });

// ---------- Dev-only Logger Middleware ----------
const devLoggerMiddleware = (storeAPI) => (next) => (action) => {
  if (!REDUX_LOG) return next(action);

  const type = action?.type || '';
  const startedAt = performance.now();
  const result = next(action);
  const endedAt = performance.now();

  // filter spam
  const isNoisy = NOISY_PREFIXES.some((p) => type.startsWith(p));
  if (isNoisy) return result;

  const isAuth = type.startsWith('auth/');
  const isWs = type.startsWith('ws/');
  const isApi = type.startsWith(`${apiSlice.reducerPath}/`);

  // only important categories
  if (isAuth || isWs || isApi) {
    // ⚠️ DO NOT print full store state (heavy + huge spam)
    // Print small snapshot only
    const state = storeAPI.getState();
    const tiny = {
      auth: {
        id: state.auth?.currentUser?.id ?? null,
        hasToken: Boolean(state.auth?.access_token || state.auth?.token),
      },
      ws: {
        isConnected: Boolean(state.ws?.isConnected),
        status: state.ws?.status ?? null,
      },
    };

     
    console.log(`%c[REDUX] ${type}`, 'color:#7dd3fc;font-weight:900;', {
      ms: Number(endedAt - startedAt).toFixed(1),
      payload: action.payload,
      tiny,
    });
  }

  return result;
};

// ---------- Store ----------
export const store = configureStore({
  reducer: createRootReducer(),

  middleware: (getDefaultMiddleware) => {
    const defaults = getDefaultMiddleware({
      thunk: true,

      // ✅ keep checks ON in dev (but ignore known big/non-serializable parts)
      immutableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredPaths: [
              // messages slice can be huge
              'messages',
              // ws packets may contain non-serializable stuff
              'ws.lastPacket',
              // RTKQ cache
              apiSlice.reducerPath,
            ],
          },

      serializableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredPaths: [
              'ws.lastPacket',
              apiSlice.reducerPath,
            ],
            ignoredActions: [
              // if your messages reducer sometimes stores non-serializable things
              'messages/updateMessages',
              'messages/setGroupMessages',
              'messages/setIndividualMessages',
            ],
          },
    });

    // ✅ order: listener -> rtkq -> ws -> logger
    return defaults
      .concat(listenerMiddleware.middleware)
      .concat(apiSlice.middleware)
      .concat(wsMiddleware)
      .concat(devLoggerMiddleware);
  },

  devTools: !IS_PROD,
});

// ✅ RTK Query: enable refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

// ---------- HMR (Vite) ----------
if (DEV && import.meta.hot) {
  import.meta.hot.accept(
    [
      '@/store/authSlice',
      '@/reducers/messageReducer',
      '@/store/wsReducer',
      '@/store/messageEntitySlice',
      '@/services/apiSlice',
    ],
    () => {
      store.replaceReducer(createRootReducer());
    },
  );
}

export default store;




