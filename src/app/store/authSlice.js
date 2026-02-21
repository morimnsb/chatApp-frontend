// chatApp-frontend/src/app/store/authSlice.js
import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import apiClient from '@/shared/api/apiClient';
import { hardResetSocket } from '@/shared/ws/socketClient';

/* -------------------- helpers -------------------- */

const STORAGE_KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
  expiresAt: 'expires_at',
};

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();

function loadAuthFromStorage() {
  try {
    const access_token = stripBearer(localStorage.getItem(STORAGE_KEYS.access) || '');
    const refreshToken = stripBearer(localStorage.getItem(STORAGE_KEYS.refresh) || '');
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

function saveAuthToStorage({ access_token, refreshToken, expiresAt }) {
  try {
    if (access_token) localStorage.setItem(STORAGE_KEYS.access, stripBearer(access_token));
    else localStorage.removeItem(STORAGE_KEYS.access);

    if (refreshToken) localStorage.setItem(STORAGE_KEYS.refresh, stripBearer(refreshToken));
    else localStorage.removeItem(STORAGE_KEYS.refresh);

    if (expiresAt) localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
    else localStorage.removeItem(STORAGE_KEYS.expiresAt);
  } catch {}
}

function clearAuthStorage() {
  saveAuthToStorage({ access_token: null, refreshToken: null, expiresAt: null });
}

// ✅ unwrap user from any backend shape
export function extractUser(data) {
  if (!data || typeof data !== 'object') return null;

  const u = data.user ?? data.me ?? data.currentUser ?? data.profile ?? null;

  if (u && typeof u === 'object' && u.id != null) return u;
  if (u && typeof u === 'object' && u.user && u.user.id != null) return u.user;

  if (data.id != null && (data.email || data.name)) return data;

  return null;
}

function parseAuthResponse(data) {
  if (!data || typeof data !== 'object') return {};

  const access_token = data.access_token || data.access || data.token || data.idToken || null;
  const refreshToken = data.refresh_token || data.refreshToken || data.refresh || null;

  let expiresAt = null;
  if (data.expires_at) {
    const raw = data.expires_at;
    if (typeof raw === 'number') expiresAt = raw;
    else {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) expiresAt = t;
    }
  } else if (data.expires_in) {
    const secs = Number(data.expires_in);
    if (!Number.isNaN(secs)) expiresAt = Date.now() + secs * 1000;
  }

  return {
    access_token: access_token ? stripBearer(access_token) : null,
    refreshToken: refreshToken ? stripBearer(refreshToken) : null,
    expiresAt: expiresAt || null,
    user: extractUser(data), // may be null
  };
}

/* -------------------- THUNKS -------------------- */

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await apiClient.post('/auth/login', credentials);
      const parsed = parseAuthResponse(res.data);
      if (!parsed.access_token) throw new Error('No access_token returned');
      return parsed; // user may be null; later /me will fill
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          'Login failed'
      );
    }
  }
);

export const meThunk = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get('/auth/me');
      const user = extractUser(res.data);
      if (!user) throw new Error('Invalid /me payload');
      return user; // ✅ always user object
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          'Me request failed'
      );
    }
  }
);

export const refreshThunk = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.post('/auth/refresh', {});
      const parsed = parseAuthResponse(res.data);
      if (!parsed.access_token) throw new Error('No access_token returned');
      return parsed;
    } catch (err) {
      return rejectWithValue('Refresh failed');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.post('/auth/logout', {});
      hardResetSocket('logout');
      return true;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          'Logout failed'
      );
    }
  }
);

/* -------------------- SLICE -------------------- */

const stored = loadAuthFromStorage();

const initialState = {
  currentUser: null, // ✅ always user object: {id,name,email}
  access_token: stored.access_token,
  refreshToken: stored.refreshToken,
  expiresAt: stored.expiresAt,
  status: 'idle',
  error: null,
  bootstrapped: false, // ✅ only BootstrapAuth controls this
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // ✅ for verify-email or any manual hydrate
    hydrateAuth(state, action) {
      const payload = action.payload || {};

      const access = payload.access_token ?? payload.access ?? payload.token ?? null;
      const refresh = payload.refreshToken ?? payload.refresh_token ?? payload.refresh ?? null;

      const user = extractUser(payload);

      if (access) state.access_token = stripBearer(access);
      if (refresh) state.refreshToken = stripBearer(refresh);

      if (payload.expiresAt != null) state.expiresAt = payload.expiresAt;

      if (payload.expires_at != null) {
        if (typeof payload.expires_at === 'number') state.expiresAt = payload.expires_at;
        else {
          const t = Date.parse(payload.expires_at);
          if (!Number.isNaN(t)) state.expiresAt = t;
        }
      }

      if (user) state.currentUser = user;

      state.error = null;

      // ✅ IMPORTANT: do NOT force bootstrapped here
      // Bootstrapping is handled centrally in BootstrapAuth

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
      state.status = 'idle';
      state.error = null;
      state.bootstrapped = true; // UI can continue
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
    const applyAuth = (state, payload) => {
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
      // ✅ do NOT set bootstrapped here
    });

    builder
      .addCase(meThunk.fulfilled, (state, action) => {
        state.currentUser = action.payload || null;
        // ✅ do NOT set bootstrapped here
      })
      .addCase(meThunk.rejected, (state) => {
        state.currentUser = null;
        // ✅ do NOT set bootstrapped here
      });

    builder.addCase(refreshThunk.fulfilled, (state, action) => {
      applyAuth(state, action.payload);
      // ✅ do NOT set bootstrapped here
    });

    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.currentUser = null;
      state.access_token = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.status = 'idle';
      state.error = null;
      state.bootstrapped = true;
      clearAuthStorage();
    });

    builder.addMatcher(
      isAnyOf(loginThunk.pending, meThunk.pending, refreshThunk.pending, logoutThunk.pending),
      (state) => {
        state.status = 'loading';
        state.error = null;
      }
    );

    builder.addMatcher(
      isAnyOf(loginThunk.fulfilled, meThunk.fulfilled, refreshThunk.fulfilled, logoutThunk.fulfilled),
      (state) => {
        state.status = 'succeeded';
      }
    );

    builder.addMatcher(
      isAnyOf(loginThunk.rejected, meThunk.rejected, refreshThunk.rejected, logoutThunk.rejected),
      (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Auth error';
      }
    );
  },
});

export const { localLogout, clearError, markBootstrapped, hydrateAuth } = authSlice.actions;
export default authSlice.reducer;

/* -------------------- SELECTORS -------------------- */

export const selectAuth = (state) => state.auth;
export const selectCurrentUser = (state) => state.auth.currentUser;
export const selectCurrentUserId = (state) => state.auth.currentUser?.id ?? null;

export const selectBootstrapped = (state) => state.auth.bootstrapped;

export const selectAccessToken = (state) => state.auth.access_token;
export const selectRefreshToken = (state) => state.auth.refreshToken;
export const selectExpiresAt = (state) => state.auth.expiresAt;

export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;

export const selectIsLoggedIn = (state) =>
  Boolean(state.auth.access_token && state.auth.currentUser?.id);
export const selectIsTokenExpired = (state) => {
  const access_token = state.auth?.access_token;
  const expiresAt = state.auth?.expiresAt;

  // اگر توکن نداریم -> مثل expired رفتار کن
  if (!access_token) return true;

  // اگر expiresAt نداریم -> به‌صورت optimistic فرض کن expired نیست
  // (چون بعضی بک‌اندها expires نمی‌فرستن)
  if (!expiresAt) return false;

  return Date.now() >= Number(expiresAt);
};
// backward compatibility
export const selectToken = (state) => state.auth.access_token;
export const selectBareToken = (state) =>
  String(state.auth.access_token || '').replace(/^Bearer\s+/i, '').trim();