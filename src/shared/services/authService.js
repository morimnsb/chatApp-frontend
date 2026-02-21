import apiClient from "@/shared/api/apiClient";

// ✅ Standard contract (ALL backends)
export async function registerApi(payload) {
  const res = await apiClient.post("/auth/register", payload, { hasAuth: false });
  return res?.data;
}

export async function verifyEmailApi(payload) {
  const res = await apiClient.post("/auth/verify-email", payload, { hasAuth: false });
  return res?.data;
}

export async function loginApi(payload) {
  const res = await apiClient.post("/auth/login", payload, { hasAuth: false });
  return res?.data;
}

export async function refreshApi(payload) {
  // payload: { refresh_token }
  const res = await apiClient.post("/auth/refresh", payload, { hasAuth: false });
  return res?.data;
}

export async function logoutApi(payload) {
  // payload: { refresh_token } optional
  const res = await apiClient.post("/auth/logout", payload || {}, { hasAuth: false });
  return res?.data;
}

// protected
export async function meApi() {
  const res = await apiClient.get("/auth/me", { hasAuth: true });
  return res?.data;
}

export async function listUsersApi() {
  const res = await apiClient.get("/auth/users", { hasAuth: true });
  return res?.data;
}


export async function resendVerifyApi(payload) {
  // payload: { email }
  const res = await apiClient.post("/auth/resend-verify", payload, { hasAuth: false });
  return res?.data;
}