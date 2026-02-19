// src/app/store/wsActions.js
import { createAction } from '@reduxjs/toolkit';

export const wsConnected = createAction('ws/connected');
export const wsDisconnected = createAction('ws/disconnected');
export const wsMessage = createAction('ws/message');
export const wsError = createAction('ws/error');
export const wsSend = createAction('ws/send');

// ✅ NEW: store current realtime backend (reverb/node/none)
export const wsSetBackend = createAction('ws/setBackend');
