// src/shared/backend/backendSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { BACKEND_KEY } from "@/shared/backend";

function getInitialKey() {
  const saved = localStorage.getItem(BACKEND_KEY);
  return saved || null; // اگر هیچ انتخابی نشده
}

const backendSlice = createSlice({
  name: "backend",
  initialState: {
    key: getInitialKey(),
  },
  reducers: {
    setBackend(state, action) {
      const key = action.payload;
      state.key = key;
      if (key) {
        localStorage.setItem(BACKEND_KEY, key);
      } else {
        localStorage.removeItem(BACKEND_KEY);
      }
    },
  },
});

export const { setBackend } = backendSlice.actions;
export default backendSlice.reducer;
