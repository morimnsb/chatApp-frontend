// src/store/wsMiddleware.js
// ⚠️ نسخه‌ی مینیمال فقط برای این‌که مزاحم Reverb نباشه

import { wsSend } from './wsActions';

const wsMiddleware = (store) => (next) => (action) => {
  // اگر کسی wsSend دیسپیچ کرد، فعلاً کاری نکنیم
  if (wsSend.match(action)) {
    console.log('[WS] (middleware disabled) would send:', action.payload);
    // اینجا عمداً socket نداریم
  }

  return next(action);
};

export default wsMiddleware;
