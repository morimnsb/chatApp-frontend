import { createReducer, type PayloadAction } from "@reduxjs/toolkit";
import { wsConnected, wsDisconnected, wsMessage, wsError, wsSetBackend } from "./wsActions";
import type { BackendKey } from "@/shared/backend";

export type WsBackendKey = BackendKey | "none";

export type WsState = {
  backend: WsBackendKey;
  isConnected: boolean;
  lastPacket: unknown | null;
  connectedAt: number | null;
  lastError: string | null;
};

const initialState: WsState = {
  backend: "none",
  isConnected: false,
  lastPacket: null,
  connectedAt: null,
  lastError: null,
};

const wsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(wsSetBackend, (state, action: PayloadAction<WsBackendKey | null | undefined>) => {
      state.backend = (action.payload || "none") as WsBackendKey;
    })
    .addCase(wsConnected, (state) => {
      state.isConnected = true;
      state.connectedAt = Date.now();
      state.lastError = null;
    })
    .addCase(wsDisconnected, (state) => {
      state.isConnected = false;
      state.connectedAt = null;
    })
    .addCase(wsMessage, (state, action: PayloadAction<unknown>) => {
      state.lastPacket = action.payload;
    })
    .addCase(wsError, (state, action: PayloadAction<string | null | undefined>) => {
      state.lastError = action.payload ?? "Unknown WS error";
    });
});

export default wsReducer;