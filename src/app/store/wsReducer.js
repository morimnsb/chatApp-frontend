// src/store/wsReducer.js
import { createReducer } from '@reduxjs/toolkit';
import {
  wsConnected,
  wsDisconnected,
  wsMessage,
  wsError,          // 🆕
} from './wsActions';

const initialState = {
  isConnected: false,
  lastPacket: null,
  connectedAt: null,
  lastError: null,   // 🆕
};

const wsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(wsConnected, (state) => {
      state.isConnected = true;
      state.connectedAt = Date.now();
      state.lastError = null;  // ✅ روی connect، خطا را پاک کن
    })
    .addCase(wsDisconnected, (state) => {
      state.isConnected = false;
      state.connectedAt = null;
      // lastError رو نگه می‌داریم که بدونیم چرا قطع شده
    })
    .addCase(wsMessage, (state, action) => {
      state.lastPacket = action.payload;
    })
    // 🆕 وقتی WebSocket خطا می‌دهد
    .addCase(wsError, (state, action) => {
      state.lastError = action.payload ?? 'Unknown WS error';
    });
});

export default wsReducer;
