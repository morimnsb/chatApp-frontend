// src/store/wsReducer.js
import { createReducer } from '@reduxjs/toolkit';
import { wsConnected, wsDisconnected, wsMessage, wsError, wsSetBackend } from './wsActions';

const initialState = {
  backend: 'none',       // ✅ NEW
  isConnected: false,
  lastPacket: null,
  connectedAt: null,
  lastError: null,
};

const wsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(wsSetBackend, (state, action) => {
      state.backend = action.payload || 'none';
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
    .addCase(wsMessage, (state, action) => {
      state.lastPacket = action.payload;
    })
    .addCase(wsError, (state, action) => {
      state.lastError = action.payload ?? 'Unknown WS error';
    });
});

export default wsReducer;
