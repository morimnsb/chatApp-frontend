// chatApp-frontend\src\shared\backend\backendSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { BACKEND_KEY, BACKENDS, type BackendKey } from "@/shared/backend";

/* ---------------- types ---------------- */

export type BackendState = {
  key: BackendKey | null;
};

/* ---------------- helpers ---------------- */

function normalizeBackendKey(v: unknown): BackendKey | null {
  const k = String(v ?? "").trim().toLowerCase();
  return (BACKENDS as readonly string[]).includes(k)
    ? (k as BackendKey)
    : null;
}

function getInitialKey(): BackendKey | null {
  try {
    const saved = localStorage.getItem(BACKEND_KEY);
    return normalizeBackendKey(saved);
  } catch {
    return null;
  }
}

/* ---------------- slice ---------------- */

const initialState: BackendState = {
  key: getInitialKey(),
};

const backendSlice = createSlice({
  name: "backend",
  initialState,
  reducers: {
    setBackend(state, action: PayloadAction<BackendKey | null>) {
      const key = normalizeBackendKey(action.payload);

      state.key = key;

      try {
        if (key) {
          localStorage.setItem(BACKEND_KEY, key);
        } else {
          localStorage.removeItem(BACKEND_KEY);
        }
      } catch {
        // ignore
      }
    },
  },
});

export const { setBackend } = backendSlice.actions;
export default backendSlice.reducer;