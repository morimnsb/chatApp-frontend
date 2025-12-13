// src/services/authService.js
import apiClient from './apiClient';

/**
 * Helper: ساختن هدر Authorization از access_token
 */
function authHeader(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * LOGIN (JWT)
 * POST /api/auth/login
 * return: { user, access_token, refresh_token?, expires_in? }
 */
export async function loginApi({ email, password }) {
  const res = await apiClient.post('/api/auth/login', {
    email: email.trim(),
    password,
  });

  const data = res.data || {};
  return {
    user: data.user ?? null,
    access_token: data.access_token ?? null,
    refresh_token: data.refresh_token ?? null,
    expires_in: data.expires_in ?? data.expires_at ?? null,
    token_type: data.token_type ?? 'Bearer',
  };
}

/**
 * ME (JWT)
 * GET /api/auth/me
 * headers: Authorization Bearer
 * return: { user }
 */
export async function meApi(accessToken) {
  try {
    const res = await apiClient.get('/api/auth/me', {
      headers: authHeader(accessToken),
    });

    return { user: res.data?.user ?? res.data ?? null };
  } catch (err) {
    if (err.response?.status === 401) {
      // توکن نامعتبر/منقضی یا کاربر لاگین نیست
      return { user: null };
    }
    throw err;
  }
}

/**
 * REFRESH (JWT)
 * POST /api/auth/refresh
 * اگر بک‌اندت refresh دارد.
 * ورودی: refresh_token
 * خروجی: access_token جدید (و شاید refresh جدید)
 */
export async function refreshApi(refreshToken) {
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

  const res = await apiClient.post('/api/auth/refresh', {
    refresh_token: refreshToken,
  });

  const data = res.data || {};
  return {
    access_token: data.access_token ?? null,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? data.expires_at ?? null,
    token_type: data.token_type ?? 'Bearer',
  };
}

/**
 * LOGOUT (JWT)
 * POST /api/auth/logout
 * headers: Authorization Bearer
 * بک‌اند باید توکن فعلی رو revoke کنه.
 */
export async function logoutApi(accessToken) {
  // اگر توکن نداری، باز هم سمت کلاینت می‌تونی logout کنی
  if (!accessToken) return true;

  await apiClient.post(
    '/api/auth/logout',
    {},
    { headers: authHeader(accessToken) },
  );

  return true;
}

/**
 * REGISTER (JWT)
 * POST /api/auth/register
 * اگر ثبت‌نام رو هم آوردی زیر api.
 * return: { message, user?, ... }
 */
export async function registerApi({
  first_name,
  last_name,
  email,
  password,
  password2,
}) {
  const payload = {
    name: `${first_name.trim()} ${last_name.trim()}`.trim(),
    email: email.trim(),
    password,
    password_confirmation: password2,
  };

  const res = await apiClient.post('/api/auth/register', payload);
  return res.data;
}

/**
 * VERIFY EMAIL (OTP)
 * POST /api/auth/verify-email
 */
export async function verifyEmailApi({ email, otp }) {
  const res = await apiClient.post('/api/auth/verify-email', {
    email: email.trim(),
    otp,
  });
  return res.data;
}

/**
 * FORGOT PASSWORD (مرحله ۱)
 * POST /api/auth/password/forgot
 */
export async function forgotPasswordApi(email) {
  const res = await apiClient.post('/api/auth/password/forgot', {
    email: email.trim(),
  });
  return res.data;
}

/**
 * RESET PASSWORD (مرحله ۲)
 * POST /api/auth/password/reset
 */
export async function resetPasswordApi({ email, token, password, password2 }) {
  const payload = {
    email: email.trim(),
    token,
    password,
    password_confirmation: password2,
  };

  const res = await apiClient.post('/api/auth/password/reset', payload);
  return res.data;
}

/**
 * CHANGE PASSWORD (JWT)
 * POST /api/auth/change-password
 * headers: Authorization Bearer
 */
export async function changePasswordApi(
  { current_password, password, password2 },
  accessToken,
) {
  if (!accessToken) throw new Error('NO_ACCESS_TOKEN');

  const payload = {
    current_password,
    password,
    password_confirmation: password2,
  };

  const res = await apiClient.post('/api/auth/change-password', payload, {
    headers: authHeader(accessToken),
  });

  return res.data;
}
