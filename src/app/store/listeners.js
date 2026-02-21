// src/store/listeners.js
import { createListenerMiddleware } from "@reduxjs/toolkit";

import {
  loginThunk,
  logoutThunk,
  refreshThunk,
  localLogout,
  selectIsTokenExpired,
} from "@/app/store/authSlice";

import { apiSlice } from "@/shared/api/apiSlice";
import { wsConnected, wsDisconnected } from "@/app/store/wsActions";

const listenerMiddleware = createListenerMiddleware();

/* 1) WS connect/disconnect based on auth */
listenerMiddleware.startListening({
  actionCreator: loginThunk.fulfilled,
  effect: async (_, api) => {
    api.dispatch(wsConnected());
  },
});

listenerMiddleware.startListening({
  actionCreator: logoutThunk.fulfilled,
  effect: async (_, api) => {
    api.dispatch(wsDisconnected());
  },
});

listenerMiddleware.startListening({
  actionCreator: loginThunk.rejected,
  effect: async (_, api) => {
    api.dispatch(wsDisconnected());
  },
});

/* 2) Auto refresh before protected RTK Query endpoints */
const protectedEndpoints = new Set([
  "getMe",
  "getUsers",
  "getRooms",
  "getRoomMessages",
  "sendMessage",
]);

listenerMiddleware.startListening({
  predicate: (action) => {
    const isQuery =
      action.type === `${apiSlice.reducerPath}/executeQuery/pending` ||
      action.type === `${apiSlice.reducerPath}/executeMutation/pending`;

    if (!isQuery) return false;

    const endpointName = action.meta?.arg?.endpointName;
    return endpointName ? protectedEndpoints.has(endpointName) : false;
  },

  effect: async (_, api) => {
    const state = api.getState();

    const refreshToken = state.auth?.refreshToken || null;
    const isExpired = selectIsTokenExpired(state);

    if (!refreshToken || !isExpired) return;

    const res = await api.dispatch(refreshThunk());

    if (refreshThunk.rejected.match(res)) {
      api.dispatch(localLogout());
      api.dispatch(wsDisconnected());
      // ✅ RTK Query cache reset (optional but recommended)
      api.dispatch(apiSlice.util.resetApiState());
    }
  },
});

export default listenerMiddleware;