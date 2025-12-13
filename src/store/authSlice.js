// src/store/authSlice.js
import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

// ------ helpers: localStorage & parsing ------

const STORAGE_KEYS = {
  token: 'token',
  refresh: 'refresh_token',
  expiresAt: 'expires_at', // ms timestamp
};

function loadAuthFromStorage() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.token) || null;
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refresh) || null;
    const rawExpiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    const expiresAt = rawExpiresAt ? Number(rawExpiresAt) || null : null;

    return { token, refreshToken, expiresAt };
  } catch {
    return { token: null, refreshToken: null, expiresAt: null };
  }
}

function saveAuthToStorage({ token, refreshToken, expiresAt }) {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.token, token);
    else localStorage.removeItem(STORAGE_KEYS.token);

    if (refreshToken) localStorage.setItem(STORAGE_KEYS.refresh, refreshToken);
    else localStorage.removeItem(STORAGE_KEYS.refresh);

    if (expiresAt)
      localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
    else localStorage.removeItem(STORAGE_KEYS.expiresAt);
  } catch {
    // در حالت آموزشی، نادیده می‌گیریم
  }
}

function clearAuthStorage() {
  saveAuthToStorage({ token: null, refreshToken: null, expiresAt: null });
}

// داده‌های برگشتی بک‌اند (هر فرمتی) → شکل استاندارد ما
function parseAuthResponse(data) {
  if (!data || typeof data !== 'object') return {};

  const token =
    data.token || data.access || data.access_token || data.idToken || null;

  const refreshToken =
    data.refresh_token || data.refreshToken || data.refresh || null;

  // expires_at می‌تونه:
  // - رشته datetime/ISO
  // - timestamp (ms)
  // - اصلاً نباشه و فقط expires_in داشته باشیم
  let expiresAt = null;

  if (data.expires_at) {
    const raw = data.expires_at;
    if (typeof raw === 'number') {
      expiresAt = raw;
    } else {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) expiresAt = t;
    }
  } else if (data.expires_in) {
    // expires_in → ثانیه از الان
    const secs = Number(data.expires_in);
    if (!Number.isNaN(secs)) {
      expiresAt = Date.now() + secs * 1000;
    }
  }

  return {
    token: token || null,
    refreshToken: refreshToken || null,
    expiresAt: expiresAt || null,
    user: data.user || null,
  };
}

// ------ Thunks ------

// ثبت‌نام: فقط دیتا رو برمی‌گردونه (پیام، email، OTP و...)
export const registerThunk = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/register`, payload);
      // این‌جا معمولاً state auth رو عوض نمی‌کنیم
      // فقط دیتا رو به کامپوننت می‌فرستیم (message, email, otp)
      return res.data;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Register failed';
      return rejectWithValue(msg);
    }
  },
);

// تأیید ایمیل با OTP: بعد از موفقیت → مثل login، توکن‌ها و user رو ست می‌کند
export const verifyEmailThunk = createAsyncThunk(
  'auth/verifyEmail',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/auth/verify-email`,
        payload, // { email, otp }
      );
      const parsed = parseAuthResponse(res.data);
      if (!parsed.token) {
        throw new Error('No token returned from verify-email endpoint');
      }
      return parsed;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Verify email failed';
      return rejectWithValue(msg);
    }
  },
);

// لاگین: {email, password} → token, refresh, user
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, credentials);
      const parsed = parseAuthResponse(res.data);
      if (!parsed.token) {
        throw new Error('No token returned from login endpoint');
      }
      return parsed;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Login failed';
      return rejectWithValue(msg);
    }
  },
);

// گرفتن اطلاعات خود کاربر (me)
export const meThunk = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const token =
        state.auth.token || localStorage.getItem(STORAGE_KEYS.token);

      if (!token) {
        throw new Error('No access token');
      }

      const res = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.data;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Me request failed';
      return rejectWithValue(msg);
    }
  },
);

// رفرش توکن
export const refreshThunk = createAsyncThunk(
  'auth/refresh',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const refreshToken =
        state.auth.refreshToken || localStorage.getItem(STORAGE_KEYS.refresh);

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const res = await axios.post(`${API_BASE}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const parsed = parseAuthResponse(res.data);
      if (!parsed.token) {
        throw new Error('No token returned from refresh endpoint');
      }
      return parsed;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Refresh failed';
      return rejectWithValue(msg);
    }
  },
);

// لاگ‌اوت از بک‌اند (اختیاری)، سپس پاک‌سازی لوکال
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const refreshToken =
        state.auth.refreshToken || localStorage.getItem(STORAGE_KEYS.refresh);

      if (refreshToken) {
        // اگر بک‌اندت logout API ندارد، می‌توانی این قسمت را حذف کنی
        await axios.post(`${API_BASE}/api/auth/logout`, {
          refresh_token: refreshToken,
        });
      }

      return true;
    } catch (err) {
      // در لاگ‌اوت معمولاً خطا را kill نمی‌کنیم، فقط گزارش می‌کنیم
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Logout failed';
      return rejectWithValue(msg);
    }
  },
);

// ------ Initial State ------

const stored = loadAuthFromStorage();

const initialState = {
  user: null,
  token: stored.token,
  refreshToken: stored.refreshToken,
  expiresAt: stored.expiresAt, // ms timestamp یا null
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  bootstrapped: false, // یعنی meThunk حداقل یک‌بار اجرا شده
};

// ------ Slice ------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // فقط state را از payload هیدراته می‌کند (مثلاً بعد از read از localStorage در جایی دیگر)
    hydrateAuth(state, action) {
      const payload = action.payload || {};
      Object.assign(state, payload);
    },

    // لاگ‌اوت لوکال (بدون تماس بک‌اند)
    localLogout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.status = 'idle';
      state.error = null;
      clearAuthStorage();
    },

    // برای کنترل دستی لودینگ (در کامپوننت‌ها در صورت نیاز)
    setLoading(state, action) {
      const isLoading = Boolean(action.payload);
      state.status = isLoading ? 'loading' : 'idle';
    },

    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- register ---
    builder.addCase(registerThunk.fulfilled, (state, action) => {
      // اینجا عمداً توکن ست نمی‌کنیم؛ فقط می‌تونی از action.payload توی UI استفاده کنی
      // مثال: { message, email, otp }
    });

    // --- verifyEmail (مثل login) ---
    builder.addCase(verifyEmailThunk.fulfilled, (state, action) => {
      state.user = action.payload.user || null;
      state.token = action.payload.token || null;
      state.refreshToken = action.payload.refreshToken || null;
      state.expiresAt = action.payload.expiresAt || null;
      saveAuthToStorage({
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      });
    });

    // --- login ---
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.user = action.payload.user || null;
      state.token = action.payload.token || null;
      state.refreshToken = action.payload.refreshToken || null;
      state.expiresAt = action.payload.expiresAt || null;
      saveAuthToStorage({
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      });
    });

    // --- me ---
    builder
      .addCase(meThunk.fulfilled, (state, action) => {
        state.user = action.payload || null;
        state.bootstrapped = true;
      })
      .addCase(meThunk.rejected, (state, action) => {
        // اگر me شکست خورد (مثلاً توکن باطل بود) → کاربر را لاگ‌اوت در نظر بگیر
        state.user = null;
        state.bootstrapped = true;
        state.token = null;
        state.refreshToken = null;
        state.expiresAt = null;
        clearAuthStorage();
      });

    // --- refresh ---
    builder.addCase(refreshThunk.fulfilled, (state, action) => {
      state.token = action.payload.token || null;
      state.refreshToken = action.payload.refreshToken || null;
      state.expiresAt = action.payload.expiresAt || null;
      saveAuthToStorage({
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      });
    });

    // --- logoutThunk ---
    builder.addCase(logoutThunk.fulfilled, (state) => {
      // بعد از لاگ‌اوت بک‌اند، لاگ‌اوت لوکال
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.expiresAt = null;
      state.status = 'idle';
      state.error = null;
      clearAuthStorage();
    });

    // ------ addMatcher برای مدیریت عمومی status/error ------

    // همه pendingها → loading + پاک‌کردن error
    builder.addMatcher(
      isAnyOf(
        registerThunk.pending,
        verifyEmailThunk.pending,
        loginThunk.pending,
        meThunk.pending,
        refreshThunk.pending,
        logoutThunk.pending,
      ),
      (state) => {
        state.status = 'loading';
        state.error = null;
      },
    );

    // fulfilled عمومی → اگر هنوز loading بود، succeeded
    builder.addMatcher(
      isAnyOf(
        registerThunk.fulfilled,
        verifyEmailThunk.fulfilled,
        loginThunk.fulfilled,
        meThunk.fulfilled,
        refreshThunk.fulfilled,
        logoutThunk.fulfilled,
      ),
      (state) => {
        if (state.status === 'loading') {
          state.status = 'succeeded';
        }
      },
    );

    // rejected عمومی → failed + ثبت error
    builder.addMatcher(
      isAnyOf(
        registerThunk.rejected,
        verifyEmailThunk.rejected,
        loginThunk.rejected,
        meThunk.rejected,
        refreshThunk.rejected,
        logoutThunk.rejected,
      ),
      (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error?.message || 'Unknown error';
      },
    );
  },
});

// ------ Actions ------

export const { hydrateAuth, localLogout, setLoading, clearError } =
  authSlice.actions;

// برای راحتی بعضی جاها (اگر می‌خواهی مستقیم استفاده کنی)
export const { reducer: authReducer } = authSlice;

// ------ Selectors ------

export const selectAuth = (state) => state.auth;
export const selectCurrentUser = (state) => state.auth.user;
export const selectBootstrapped = (state) => state.auth.bootstrapped;
export const selectToken = (state) => state.auth.token;
export const selectRefreshToken = (state) => state.auth.refreshToken;
export const selectExpiresAt = (state) => state.auth.expiresAt;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;

// سازگار با ProtectedRoute / LoginForm
export const selectIsLoggedIn = (state) =>
  Boolean(state.auth.token && state.auth.user);

// برای auto-expiration / auto-refresh در listenerMiddleware
export const selectIsTokenExpired = (state) => {
  const { token, expiresAt } = state.auth;
  if (!token) return true;
  if (!expiresAt) return false; // اگر expiry نداریم، فرض می‌کنیم باز است
  return Date.now() >= expiresAt;
};

// ------ Default export (برای configureStore) ------

export default authSlice.reducer;
