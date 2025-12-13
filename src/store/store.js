// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authStore';
import messageReducer from '../reducers/messageReducer';

// اکشن‌ها و مسیرهای پرحجم که بهتر است از چک‌ها خارج شوند
const IGNORED_ACTIONS = [
  'messages/updateMessages',
  'messages/setGroupMessages',
  'messages/setIndividualMessages',
];

const IGNORED_PATHS = [
  'messages.items', // لیست طولانی پیام‌ها
  'messages.groups',
  'messages.individual',
  // اگر شیء سوکت/اکو را در استور می‌گذاشتی (توصیه نمی‌شود):
  // 'messages.socket',
];

// در حالت پروداکشن، چک‌ها را سبک‌تر/خاموش می‌کنیم
const isProd = process.env.NODE_ENV === 'production';

const store = configureStore({
  reducer: {
    auth: authReducer,
    messages: messageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: isProd
        ? false
        : {
            warnAfter: 128, // پیش‌فرض 32ms → مقدار بالاتر برای dev
            ignoredPaths: IGNORED_PATHS,
          },
      serializableCheck: isProd
        ? false
        : {
            warnAfter: 128,
            ignoredActions: IGNORED_ACTIONS,
            ignoredPaths: IGNORED_PATHS,
          },
    }),
  devTools: !isProd
    ? {
        trace: false, // برای پروفایلینگ عمیق می‌تونی true کنی
        traceLimit: 25,
      }
    : false,
});

export default store;
