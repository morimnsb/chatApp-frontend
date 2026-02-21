// chatApp-frontend\src\app\store\wsMiddleware.ts
import type { Middleware } from "@reduxjs/toolkit";
import { wsSend } from "./wsActions";

const wsMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  // اگر کسی wsSend دیسپیچ کرد
  if (wsSend.match(action)) {
    console.log("[WS] (middleware disabled) would send:", action.payload);

    // اینجا عمداً socket نداریم
    // بعداً می‌تونیم بر اساس backend تصمیم بگیریم:
    // const state = storeAPI.getState();
    // const backend = state.backend.key;
  }

  return next(action);
};

export default wsMiddleware;
