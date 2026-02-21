// src/app/store/store.ts
import { configureStore, combineReducers, type Middleware } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import authReducer from "@/app/store/authSlice";
import messagesEntityReducer from "@/app/store/messageEntitySlice";
import messageReducer from "@/features/chat/state/messageReducer";

import listenerMiddleware from "@/app/store/listeners";
import wsReducer from "@/app/store/wsReducer";
import { apiSlice } from "@/shared/api/apiSlice";
import wsMiddleware from "@/app/store/wsMiddleware";

import { attachStore } from "@/shared/api/apiClient";
import { attachWsStore } from "@/shared/ws/socketClient";
import { attachRealtimeStore } from "@/shared/config/realtime";

import backendReducer from "@/shared/backend/backendSlice";

// ---------- ENV ----------
const IS_PROD = import.meta.env.PROD === true;

// ✅ logger is OPT-IN (default OFF)
const DEV = import.meta.env.DEV === true;
const REDUX_LOG = DEV && String(import.meta.env.VITE_REDUX_LOG || "") === "true";

const NOISY_PREFIXES = [
  `${apiSlice.reducerPath}/internalSubscriptions/`,
  `${apiSlice.reducerPath}/executeQuery/`,
  `${apiSlice.reducerPath}/executeMutation/`,
  `${apiSlice.reducerPath}/config/`,
] as const;

// ---------- Root Reducer ----------
const createRootReducer = () =>
  combineReducers({
    backend: backendReducer,
    auth: authReducer,
    messages: messageReducer,
    ws: wsReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
    messagesEntity: messagesEntityReducer,
  });

// ✅ IMPORTANT: define middleware BEFORE store (no TDZ crash)
const devLoggerMiddleware: Middleware = (storeAPI) => (next) => (action: any) => {
  if (!REDUX_LOG) return next(action);

  const type: string = action?.type || "";
  const startedAt = performance.now();
  const result = next(action);
  const endedAt = performance.now();

  const isNoisy = NOISY_PREFIXES.some((p) => type.startsWith(p));
  if (isNoisy) return result;

  const isAuth = type.startsWith("auth/");
  const isWs = type.startsWith("ws/");
  const isApi = type.startsWith(`${apiSlice.reducerPath}/`);

  if (isAuth || isWs || isApi) {
    const state = storeAPI.getState() as any;

    const tiny = {
      auth: {
        id: state.auth?.currentUser?.id ?? null,
        hasToken: Boolean(state.auth?.access_token),
        hasRefresh: Boolean(state.auth?.refreshToken),
        bootstrapped: Boolean(state.auth?.bootstrapped),
      },
      ws: {
        isConnected: Boolean(state.ws?.isConnected),
        status: state.ws?.status ?? null,
      },
    };

    console.log(`%c[REDUX] ${type}`, "color:#7dd3fc;font-weight:900;", {
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

      immutableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredPaths: ["messages", "ws.lastPacket", apiSlice.reducerPath],
          },

      serializableCheck: IS_PROD
        ? false
        : {
            warnAfter: 128,
            ignoredPaths: ["ws.lastPacket", apiSlice.reducerPath],
            ignoredActions: [
              "messages/updateMessages",
              "messages/setGroupMessages",
              "messages/setIndividualMessages",
            ],
          },
    });

    return defaults
      .concat(listenerMiddleware.middleware)
      .concat(apiSlice.middleware)
      .concat(wsMiddleware)
      .concat(devLoggerMiddleware);
  },

  devTools: !IS_PROD,
});

// ---------- Types ----------
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ✅ RTK Query listeners
setupListeners(store.dispatch);

// ✅ link redux store to apiClient (token reading)
attachStore(store);

// ✅ link redux store to socket client (so socket can read token from auth slice)
attachWsStore(store);

attachRealtimeStore(store);

export default store;