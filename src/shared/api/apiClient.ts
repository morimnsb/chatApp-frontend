// chatApp-frontend\src\shared\api\apiClient.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import {
  getChosenBackendKey,
  resolveApiBase,
  type BackendKey,
} from "@/shared/backend";

/* ------------------------- types ------------------------- */
export type BackendKind =
  | BackendKey
  | "laravel"
  | "nest"
  | "fastapi"
  | (string & {});

export type AppStoreLike = {
  getState?: () => any;
};

export type AppAxiosRequestConfig = AxiosRequestConfig & {
  hasAuth?: boolean; // default true
};

/* ------------------------- URL helpers ------------------------- */
const ABSOLUTE_RE = /^(?:https?:)?\/\//i;

const isAbsoluteUrl = (u: unknown) => ABSOLUTE_RE.test(String(u ?? ""));

function normalizeUrl(path: unknown): string | null {
  const p = String(path ?? "").trim();
  if (!p) return null;
  if (isAbsoluteUrl(p)) return p;

  const cleaned = p.replace(/^\/+/, "").replace(/\s+/g, "");
  return `/${cleaned}`;
}

function buildFullUrl(config: AxiosRequestConfig): string {
  const base = String((config as any)?.baseURL ?? "").replace(/\/+$/, "");
  const url = String((config as any)?.url ?? "");

  if (isAbsoluteUrl(url)) return url;

  const path = url.replace(/^\/+/, "");
  return base ? `${base}/${path}` : `/${path}`;
}

/* ------------------------- env / debug ------------------------- */
const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";

/* ------------------------- backend helpers ------------------------- */
export function readBackendChoice(): string | null {
  try {
    return getChosenBackendKey();
  } catch {
    return null;
  }
}

function normalizeBackendKind(kind?: BackendKind | null): BackendKind | null {
  const k = String(kind ?? "").trim().toLowerCase();
  if (!k) return null;

  // alias safety
  if (k === "laravel") return "reverb";
  return k as BackendKind;
}

function fallbackBase(): string {
  return String(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
}

export function resolveClientApiBase(kind?: BackendKind | null): string {
  const normalized = normalizeBackendKind(kind);
  const chosen = normalizeBackendKind(readBackendChoice());

  try {
    if (normalized) return resolveApiBase(normalized as BackendKey);
    if (chosen) return resolveApiBase(chosen as BackendKey);
  } catch {}

  return fallbackBase();
}

function defaultUseCredentials(kind?: BackendKind | null): boolean {
  const k = String(normalizeBackendKind(kind) ?? "").toLowerCase();

  // Laravel/Reverb can use cookie/sanctum-style flows.
  // Node/Django normally use Bearer tokens in your current architecture.
  return k === "reverb";
}

/* ------------------------- axios instance ------------------------- */
const initialBackend = readBackendChoice();

const apiClient: AxiosInstance = axios.create({
  baseURL: resolveClientApiBase(initialBackend),
  headers: { "Content-Type": "application/json" },
  withCredentials: defaultUseCredentials(initialBackend),
});

let _store: AppStoreLike | null = null;

export function attachStore(store: AppStoreLike) {
  _store = store;
}

export function setApiBase(nextKind?: BackendKind | null): string {
  const normalized = normalizeBackendKind(nextKind);
  const nextBase = resolveClientApiBase(normalized);
  const creds = defaultUseCredentials(normalized);

  apiClient.defaults.baseURL = nextBase;
  apiClient.defaults.withCredentials = creds;

  if (DEBUG) {
    console.log("[apiClient] baseURL set =>", nextBase, {
      backend: normalized,
      withCredentials: creds,
    });
  }

  return nextBase;
}

if (DEBUG) {
  console.log("[apiClient] init =>", {
    backend: initialBackend,
    baseURL: apiClient.defaults.baseURL,
    withCredentials: apiClient.defaults.withCredentials,
  });
}

/* ------------------------- cancel / network detection ------------------------- */
export const isCanceled = (err: any) =>
  err?.code === "ERR_CANCELED" ||
  err?.name === "CanceledError" ||
  err?.name === "AbortError" ||
  String(err?.message || "").toLowerCase().includes("canceled") ||
  axios.isCancel?.(err) === true;

const isNetworkDown = (err: any) =>
  err?.code === "ERR_NETWORK" ||
  err?.code === "ECONNABORTED" ||
  /Network Error/i.test(String(err?.message || ""));

function getReduxToken(): string | null {
  try {
    const state = _store?.getState?.() as any;
    return state?.auth?.access_token || null;
  } catch {
    return null;
  }
}

/* ------------------------- request interceptor ------------------------- */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const cfg = config as InternalAxiosRequestConfig & AppAxiosRequestConfig;

    const chosen = normalizeBackendKind(readBackendChoice());
    const nextBase = resolveClientApiBase(chosen);

    const hasAuth = cfg.hasAuth !== false;

    const creds =
      typeof cfg.withCredentials === "boolean"
        ? cfg.withCredentials
        : defaultUseCredentials(chosen);

    if (apiClient.defaults.baseURL !== nextBase) {
      apiClient.defaults.baseURL = nextBase;
      if (DEBUG) {
        console.log("[apiClient] baseURL sync =>", nextBase, { backend: chosen });
      }
    }

    if (apiClient.defaults.withCredentials !== creds) {
      apiClient.defaults.withCredentials = creds;
      if (DEBUG) {
        console.log("[apiClient] withCredentials sync =>", creds, { backend: chosen });
      }
    }

    cfg.baseURL = nextBase;
    cfg.withCredentials = creds;

    cfg.headers = cfg.headers || ({} as any);
    const h = cfg.headers as Record<string, any>;

    if (!h.Accept) h.Accept = "application/json";
    if (!h["Content-Type"]) h["Content-Type"] = "application/json";

    if (hasAuth) {
      const token = getReduxToken();
      if (token && !h.Authorization) {
        h.Authorization = `Bearer ${String(token).replace(/^Bearer\s+/i, "").trim()}`;
      }
    } else if (h.Authorization) {
      delete h.Authorization;
    }

    if (cfg.url) {
      const nu = normalizeUrl(cfg.url);
      if (nu) cfg.url = nu;
    }

    if (DEBUG) {
      console.log("[apiClient] ->", {
        backend: chosen,
        baseURL: nextBase,
        method: String(cfg.method || "get").toUpperCase(),
        url: buildFullUrl(cfg),
        hasAuth: Boolean((cfg.headers as any)?.Authorization),
        withCredentials: Boolean(cfg.withCredentials),
        hasAuthFlag: hasAuth,
      });
    }

    return cfg;
  },
  (err: any) => {
    if (!isCanceled(err)) {
      console.log("[apiClient] request error", {
        message: err?.message,
        code: err?.code,
      });
    }
    return Promise.reject(err);
  }
);

/* ------------------------- response interceptor ------------------------- */
apiClient.interceptors.response.use(
  (res: AxiosResponse) => {
    if (DEBUG) {
      console.log("[apiClient] <-", {
        status: res.status,
        url: buildFullUrl(res.config),
      });
    }
    return res;
  },
  (err: AxiosError) => {
    if (isCanceled(err)) return Promise.reject(err);

    const status = err?.response?.status;
    const url = buildFullUrl(((err as any)?.config || {}) as AxiosRequestConfig);
    const code = (err as any)?.code;

    if (isNetworkDown(err)) {
      console.log("[apiClient] xx", {
  message: err.message,
  code,
  status,
  url,
  data: JSON.stringify(err.response?.data, null, 2),
  headers: err.response?.headers,
});
      return Promise.reject(err);
    }

    console.log("[apiClient] xx", {
  message: err.message,
  code,
  status,
  url,
  data: JSON.stringify(err.response?.data, null, 2),
  headers: err.response?.headers,
});

    return Promise.reject(err);
  }
);

export default apiClient;

/* ------------------------- data-only helpers ------------------------- */
export const http = {
  request: <T = any>(config: AppAxiosRequestConfig) =>
    apiClient.request(config).then((r) => r.data as T),

  get: <T = any>(url: string, config?: AppAxiosRequestConfig) =>
    apiClient.get(url, config).then((r) => r.data as T),

  post: <T = any>(url: string, data?: any, config?: AppAxiosRequestConfig) =>
    apiClient.post(url, data, config).then((r) => r.data as T),

  put: <T = any>(url: string, data?: any, config?: AppAxiosRequestConfig) =>
    apiClient.put(url, data, config).then((r) => r.data as T),

  patch: <T = any>(url: string, data?: any, config?: AppAxiosRequestConfig) =>
    apiClient.patch(url, data, config).then((r) => r.data as T),

  delete: <T = any>(url: string, config?: AppAxiosRequestConfig) =>
    apiClient.delete(url, config).then((r) => r.data as T),

  cancelable: {
    get: <T = any>(url: string, config: AppAxiosRequestConfig = {}) => {
      const controller = new AbortController();
      const promise = apiClient
        .get(url, { ...config, signal: controller.signal } as any)
        .then((r) => r.data as T);

      return {
        promise,
        cancel: () => controller.abort(),
      };
    },

    post: <T = any>(url: string, data?: any, config: AppAxiosRequestConfig = {}) => {
      const controller = new AbortController();
      const promise = apiClient
        .post(url, data, { ...config, signal: controller.signal } as any)
        .then((r) => r.data as T);

      return {
        promise,
        cancel: () => controller.abort(),
      };
    },
  },
};