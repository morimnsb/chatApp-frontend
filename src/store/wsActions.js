// src/store/wsActions.js
import { createAction } from '@reduxjs/toolkit';

// وقتی WebSocket وصل شد
export const wsConnected = createAction('ws/connected');

// وقتی WebSocket قطع شد
export const wsDisconnected = createAction('ws/disconnected');

// وقتی از WebSocket پیامی گرفتیم
export const wsMessage = createAction('ws/message');

// 🆕 برای نگه داشتن آخرین خطا (که توی wsReducer استفاده می‌کنیم)
export const wsError = createAction('ws/error');

// 🆕 اکشنی که wsMiddleware گوش می‌دهد و پیام را روی سوکت می‌فرستد
// (مهم اینه که export بشه؛ اسم type رو می‌تونیم آزاد انتخاب کنیم)
export const wsSend = createAction('ws/send');
