// chatApp-frontend\src\app\store\listeners.ts
import { createListenerMiddleware, type AnyAction } from "@reduxjs/toolkit";

import {
  loginThunk,
  logoutThunk,
  refreshThunk,
  localLogout,
  selectIsTokenExpired,
} from "@/app/store/authSlice";

import { apiSlice } from "@/shared/api/apiSlice";
import { wsConnected, wsDisconnected } from "@/app/store/wsActions";

// ✅ NO store import => no circular
const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: loginThunk.fulfilled,
  effect: async (_action, api) => {
    api.dispatch(wsConnected());
  },
});

listenerMiddleware.startListening({
  actionCreator: logoutThunk.fulfilled,
  effect: async (_action, api) => {
    api.dispatch(wsDisconnected());
  },
});

listenerMiddleware.startListening({
  actionCreator: loginThunk.rejected,
  effect: async (_action, api) => {
    api.dispatch(wsDisconnected());
  },
});

const protectedEndpoints = new Set<string>([
  "getMe",
  "getUsers",
  "getRooms",
  "getRoomMessages",
  "sendMessage",
]);

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => {
    const isQuery =
      action.type === `${apiSlice.reducerPath}/executeQuery/pending` ||
      action.type === `${apiSlice.reducerPath}/executeMutation/pending`;

    if (!isQuery) return false;

    const endpointName: string | undefined = action.meta?.arg?.endpointName;
    return endpointName ? protectedEndpoints.has(endpointName) : false;
  },

  effect: async (_action, api) => {
    const state = api.getState() as any; // ✅ minimal cast (no circular types)

    const refreshToken = state.auth?.refreshToken || null;
    const isExpired = selectIsTokenExpired(state);

    if (!refreshToken || !isExpired) return;

    const res = await api.dispatch(refreshThunk());

    if (refreshThunk.rejected.match(res)) {
      api.dispatch(localLogout());
      api.dispatch(wsDisconnected());
      api.dispatch(apiSlice.util.resetApiState());
    }
  },
});

export default listenerMiddleware;