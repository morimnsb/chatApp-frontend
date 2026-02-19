import apiClient from "@/shared/api/apiClient";

/**
 * همه request ها از apiClient عبور می‌کنند.
 * خروجی را data برمی‌گردانیم تا UI ساده بماند.
 */

export async function registerApi(payload) {
  const res = await apiClient.post("/auth/register", payload);
  return res?.data;
}

export async function verifyEmailApi(payload) {
  const res = await apiClient.post("/auth/verify-email", payload);
  return res?.data;
}

export async function loginApi(payload) {
  try {
    const res = await apiClient.post("/auth/login", payload);
    return res?.data;
  } catch (e) {
    const status = e?.response?.status;
    const code =
      e?.response?.data?.meta?.code ||
      e?.response?.data?.code ||
      e?.response?.data?.message;

    // ✅ همه کاربران باید verified باشند
    // پس اگر 403 با این کد آمد، UI باید بره verify-email
    if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
      const err = new Error("EMAIL_NOT_VERIFIED");
      err.status = 403;
      err.code = "EMAIL_NOT_VERIFIED";
      err.email = payload?.email;
      throw err;
    }

    throw e;
  }
}

export async function refreshApi() {
  const res = await apiClient.post("/auth/refresh");
  return res?.data;
}

export async function logoutApi() {
  const res = await apiClient.post("/auth/logout");
  return res?.data;
}

export async function meApi() {
  const res = await apiClient.get("/auth/me");
  return res?.data;
}

export async function listUsersApi() {
  const res = await apiClient.get("/auth/users");
  return res?.data;
}
