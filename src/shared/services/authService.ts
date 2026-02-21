// chatApp-frontend\src\shared\services\authService.ts
// chatApp-frontend/src/shared/services/authService.ts
import { http } from "@/shared/api/apiClient";

/* ----------------------------- shared types ----------------------------- */

export type ApiResponse<T = unknown> = T;

export type RegisterPayload = Record<string, unknown>;
export type VerifyEmailPayload = { token: string } | Record<string, unknown>;
export type LoginPayload = { email: string; password: string } | Record<string, unknown>;
export type RefreshPayload = { refresh_token: string };
export type LogoutPayload = { refresh_token?: string };

export type ResendVerifyPayload = { email: string };

export type ForgotPasswordPayload = { email: string } | Record<string, unknown>;

export type ResetPasswordPayload =
  | { token: string; password: string; password_confirmation?: string }
  | Record<string, unknown>;

export type ChangePasswordPayload =
  | { current_password: string; new_password: string; new_password_confirmation?: string }
  | Record<string, unknown>;

/* ---------------------- optional: response shapes ---------------------- */

export type AuthTokensResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string | number;
  expires_in?: number;
  user?: any;
  me?: any;
};

/* ------------------------- Standard contract ------------------------- */

export async function registerApi<T = ApiResponse>(payload: RegisterPayload): Promise<T> {
  return http.post<T>("/auth/register", payload, { hasAuth: false });
}

export async function verifyEmailApi<T = ApiResponse>(payload: VerifyEmailPayload): Promise<T> {
  return http.post<T>("/auth/verify-email", payload, { hasAuth: false });
}

export async function loginApi<T = AuthTokensResponse>(payload: LoginPayload): Promise<T> {
  return http.post<T>("/auth/login", payload, { hasAuth: false });
}

export async function refreshApi<T = AuthTokensResponse>(payload: RefreshPayload): Promise<T> {
  return http.post<T>("/auth/refresh", payload, { hasAuth: false });
}

export async function logoutApi<T = ApiResponse>(payload?: LogoutPayload): Promise<T> {
  return http.post<T>("/auth/logout", payload || {}, { hasAuth: false });
}

/* ------------------------------ protected ------------------------------ */

export async function meApi<T = ApiResponse>(): Promise<T> {
  return http.get<T>("/auth/me", { hasAuth: true });
}

export async function listUsersApi<T = ApiResponse>(): Promise<T> {
  return http.get<T>("/auth/users", { hasAuth: true });
}

export async function resendVerifyApi<T = ApiResponse>(payload: ResendVerifyPayload): Promise<T> {
  return http.post<T>("/auth/resend-verify", payload, { hasAuth: false });
}

/* ---------------------- password-related exports ---------------------- */

export async function forgotPasswordApi<T = ApiResponse>(
  payload: ForgotPasswordPayload
): Promise<T> {
  return http.post<T>("/auth/forgot-password", payload, { hasAuth: false });
}

export async function resetPasswordApi<T = ApiResponse>(
  payload: ResetPasswordPayload
): Promise<T> {
  return http.post<T>("/auth/reset-password", payload, { hasAuth: false });
}

export async function changePasswordApi<T = ApiResponse>(
  payload: ChangePasswordPayload
): Promise<T> {
  return http.post<T>("/auth/change-password", payload, { hasAuth: true });
}