// chatApp-frontend/src/app/store/authSlice.ts
import { createSlice, createAsyncThunk, isAnyOf, type PayloadAction } from "@reduxjs/toolkit";
import apiClient from "@/shared/api/apiClient";
import { hardResetSocket } from "@/shared/ws/socketClient";
import type { RootState } from "@/app/store/store";

/* -------------------- types -------------------- */

export type UserLike = {
  id: number | string;
  name?: string | null;
  email?: string | null;
  [k: string]: any;
};

type AuthStatus = "idle" | "loading" | "succeeded" | "failed";

export type AuthState = {
  currentUser: UserLike | null;
  access_token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  status: AuthStatus;
  error: string | null;
  bootstrapped: boolean;
};

type AuthPayload = {
  access_token?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user?: UserLike | null;
};

export type LoginCredentials = Record<string, any>;
type RejectValue = string;

/* -------------------- helpers -------------------- */

const STORAGE_KEYS = {
  access: "access_token",
  refresh: "refresh_token",
  expiresAt: "expires_at",
} as const;

const stripBearer = (t: unknown): string =>
  String(t || "").replace(/^Bearer\s+/i, "").trim();

function loadAuthFromStorage(): Pick<AuthState, "access_token" | "refreshToken" | "expiresAt"> {
  try {
    const access_token = stripBearer(localStorage.getItem(STORAGE_KEYS.access) || "");
    const refreshToken = stripBearer(localStorage.getItem(STORAGE_KEYS.refresh) || "");
    const rawExpiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    const expiresAt = rawExpiresAt ? Number(rawExpiresAt) || null : null;

    return {
      access_token: access_token || null,
      refreshToken: refreshToken || null,
      expiresAt,
    };
  } catch {
    return { access_token: null, refreshToken: null, expiresAt: null };
  }
}

function saveAuthToStorage(v: {
  access_token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}): void {
  const { access_token, refreshToken, expiresAt } = v;

  try {
    if (access_token) localStorage.setItem(STORAGE_KEYS.access, stripBearer(access_token));
    else localStorage.removeItem(STORAGE_KEYS.access);

    if (refreshToken) localStorage.setItem(STORAGE_KEYS.refresh, stripBearer(refreshToken));
    else localStorage.removeItem(STORAGE_KEYS.refresh);

    if (expiresAt) localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
    else localStorage.removeItem(STORAGE_KEYS.expiresAt);
  } catch {
    // ignore
  }
}

function clearAuthStorage(): void {
  saveAuthToStorage({ access_token: null, refreshToken: null, expiresAt: null });
}

export function extractUser(data: unknown): UserLike | null {
  if (!data || typeof data !== "object") return null;

  const d = data as any;
  const u = d.user ?? d.me ?? d.currentUser ?? d.profile ?? null;

  if (u && typeof u === "object" && u.id != null) return u as UserLike;
  if (u && typeof u === "object" && u.user && u.user.id != null) return u.user as UserLike;

  if (d.id != null && (d.email || d.name)) return d as UserLike;

  return null;
}

function parseAuthResponse(data: unknown): AuthPayload {
  if (!data || typeof data !== "object") return {};

  const d = data as any;

  const access_token = d.access_token || d.access || d.token || d.idToken || null;
  const refreshToken = d.refresh_token || d.refreshToken || d.refresh || null;

  let expiresAt: number | null = null;

  if (d.expires_at) {
    const raw = d.expires_at;
    if (typeof raw === "number") expiresAt = raw;
    else {
      const t = Date.parse(String(raw));
      if (!Number.isNaN(t)) expiresAt = t;
    }
  } else if (d.expires_in) {
    const secs = Number(d.expires_in);
    if (!Number.isNaN(secs)) expiresAt = Date.now() + secs * 1000;
  } else if (d.refresh_max_age_ms) {
    // optional fallback if backend only gives refresh age
    const ms = Number(d.refresh_max_age_ms);
    if (!Number.isNaN(ms) && ms > 0) {
      // this is not access expiry, but still better than null if your app relies on it loosely
      expiresAt = Date.now() + ms;
    }
  }

  return {
    access_token: access_token ? stripBearer(access_token) : null,
    refreshToken: refreshToken ? stripBearer(refreshToken) : null,
    expiresAt: expiresAt || null,
    user: extractUser(d),
  };
}

function errToMessage(err: unknown, fallback: string): string {
  const e = err as any;
  return (
    e?.response?.data?.message ||
    e?.response?.data?.detail ||
    e?.message ||
    fallback
  );
}

/* -------------------- THUNKS -------------------- */

export const loginThunk = createAsyncThunk<AuthPayload, LoginCredentials, { rejectValue: RejectValue }>(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/auth/login", credentials, {
        hasAuth: false,
        withCredentials: false,
      });

      const parsed = parseAuthResponse(res.data);
      if (!parsed.access_token) throw new Error("No access_token returned");

      return parsed;
    } catch (err) {
      return rejectWithValue(errToMessage(err, "Login failed"));
    }
  }
);

export const meThunk = createAsyncThunk<UserLike, void, { rejectValue: RejectValue }>(
  "auth/me",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/auth/me", {
        hasAuth: true,
      });

      const user = extractUser(res.data);
      if (!user) throw new Error("Invalid /me payload");
      return user;
    } catch (err) {
      return rejectWithValue(errToMessage(err, "Me request failed"));
    }
  }
);

export const refreshThunk = createAsyncThunk<AuthPayload, void, { rejectValue: RejectValue }>(
  "auth/refresh",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const refreshToken =
        stripBearer(state?.auth?.refreshToken) ||
        stripBearer(localStorage.getItem(STORAGE_KEYS.refresh) || "");

      const res = await apiClient.post(
        "/auth/refresh",
        refreshToken ? { refresh_token: refreshToken } : {},
        {
          hasAuth: false,
          withCredentials: false,
        }
      );

      const parsed = parseAuthResponse(res.data);
      if (!parsed.access_token) throw new Error("No access_token returned");

      // keep old refresh if backend didn't resend it
      if (!parsed.refreshToken) {
        parsed.refreshToken = refreshToken || null;
      }

      return parsed;
    } catch (err) {
      return rejectWithValue(errToMessage(err, "Refresh failed"));
    }
  }
);

export const logoutThunk = createAsyncThunk<boolean, void, { state: RootState; rejectValue: RejectValue }>(
  "auth/logout",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const refreshToken =
        stripBearer(state?.auth?.refreshToken) ||
        stripBearer(localStorage.getItem(STORAGE_KEYS.refresh) || "");

      await apiClient.post(
        "/auth/logout",
        refreshToken ? { refresh_token: refreshToken } : {},
        {
          hasAuth: true,
        }
      );

      hardResetSocket("logout");
      return true;
    } catch (err) {
      return rejectWithValue(errToMessage(err, "Logout failed"));
    }
  }
);

/* -------------------- SLICE -------------------- */

const stored = loadAuthFromStorage();

const initialState: AuthState = {
  currentUser: null,
  access_token: stored.access_token,
  refreshToken: stored.refreshToken,
  expiresAt: stored.expiresAt,
  status: "idle",
  error: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(state, action: PayloadAction<Record<string, any> | undefined>) {
      const payload = action.payload || {};

      const access = payload.access_token ?? payload.access ?? payload.token ?? null;
      const refresh = payload.refreshToken ?? payload.refresh_token ?? payload.refresh ?? null;

      const user = extractUser(payload);

      if (access) state.access_token = stripBearer(access);
      if (refresh) state.refreshToken = stripBearer(refresh);

      if (payload.expiresAt != null) state.expiresAt = payload.expiresAt;

      if (payload.expires_at != null) {
        if (typeof payload.expires_at === "number") state.expiresAt = payload.expires_at;
        else {
          const t = Date.parse(String(payload.expires_at));
          if (!Number.isNaN(t)) state.expiresAt = t;
        }
      }

      if (user) state.currentUser = user;

      state.error = null;

      saveAuthToStorage({
        access_token: state.access_token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      });
    },

    localLogout(state) {
      state.currentUser = null;
      state.access_token = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.status = "idle";
      state.error = null;
      state.bootstrapped = true;
      clearAuthStorage();
    },

    clearError(state) {
      state.error = null;
    },

    markBootstrapped(state) {
      state.bootstrapped = true;
    },
  },

  extraReducers: (builder) => {
    const applyAuth = (state: AuthState, payload?: AuthPayload) => {
      if (payload?.access_token) state.access_token = payload.access_token;
      if (payload?.refreshToken) state.refreshToken = payload.refreshToken;
      if (payload?.expiresAt) state.expiresAt = payload.expiresAt;

      if (payload?.user) state.currentUser = payload.user;

      saveAuthToStorage({
        access_token: state.access_token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      });
    };

    builder.addCase(loginThunk.fulfilled, (state, action) => {
      applyAuth(state, action.payload);
    });

    builder
      .addCase(meThunk.fulfilled, (state, action) => {
        state.currentUser = action.payload || null;
      })
      .addCase(meThunk.rejected, (state) => {
        state.currentUser = null;
      });

    builder.addCase(refreshThunk.fulfilled, (state, action) => {
      applyAuth(state, action.payload);
    });

    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.currentUser = null;
      state.access_token = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.status = "idle";
      state.error = null;
      state.bootstrapped = true;
      clearAuthStorage();
    });

    builder.addMatcher(
      isAnyOf(loginThunk.pending, meThunk.pending, refreshThunk.pending, logoutThunk.pending),
      (state) => {
        state.status = "loading";
        state.error = null;
      }
    );

    builder.addMatcher(
      isAnyOf(loginThunk.fulfilled, meThunk.fulfilled, refreshThunk.fulfilled, logoutThunk.fulfilled),
      (state) => {
        state.status = "succeeded";
      }
    );

    builder.addMatcher(
      isAnyOf(loginThunk.rejected, meThunk.rejected, refreshThunk.rejected, logoutThunk.rejected),
      (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string) || "Auth error";
      }
    );
  },
});

export const { localLogout, clearError, markBootstrapped, hydrateAuth } = authSlice.actions;
export default authSlice.reducer;

/* -------------------- SELECTORS -------------------- */

export const selectAuth = (state: RootState) => state.auth;
export const selectCurrentUser = (state: RootState) => state.auth.currentUser;
export const selectCurrentUserId = (state: RootState) => state.auth.currentUser?.id ?? null;

export const selectBootstrapped = (state: RootState) => state.auth.bootstrapped;

export const selectAccessToken = (state: RootState) => state.auth.access_token;
export const selectRefreshToken = (state: RootState) => state.auth.refreshToken;
export const selectExpiresAt = (state: RootState) => state.auth.expiresAt;

export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAuthError = (state: RootState) => state.auth.error;

export const selectIsLoggedIn = (state: RootState) =>
  Boolean(state.auth.access_token && state.auth.currentUser?.id);

export const selectIsTokenExpired = (state: RootState) => {
  const access_token = state.auth?.access_token;
  const expiresAt = state.auth?.expiresAt;

  if (!access_token) return true;
  if (!expiresAt) return false;

  return Date.now() >= Number(expiresAt);
};

export const selectToken = (state: RootState) => state.auth.access_token;

export const selectBareToken = (state: RootState) =>
  String(state.auth.access_token || "").replace(/^Bearer\s+/i, "").trim();