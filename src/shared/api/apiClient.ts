// chatApp-frontend\src\shared\api\apiClient.ts
// chatApp-frontend/src/shared/api/apiClient.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

/* ------------------------- types ------------------------- */
export type BackendKind =
  | "reverb"
  | "laravel"
  | "node"
  | "nest"
  | "django"
  | "fastapi"
  | (string & {});

export type AppStoreLike = {
  getState?: () => any;
};

// ✅ your custom flags
export type AppAxiosRequestConfig = AxiosRequestConfig & {
  hasAuth?: boolean; // default true
};

type EnvKey =
  | "VITE_API_BASE_REVERB"
  | "VITE_API_BASE_NODE"
  | "VITE_API_BASE_NEST"
  | "VITE_API_BASE_DJANGO"
  | "VITE_API_BASE_FASTAPI"
  | "VITE_API_URL"
  | "VITE_CHAT_DEBUG";

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

/* ------------------------- ENV ------------------------- */
const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";

/* ------------------------- backend -> env map ------------------------- */
const BACKEND_ENV_MAP: Record<string, EnvKey> = {
  reverb: "VITE_API_BASE_REVERB",
  laravel: "VITE_API_BASE_REVERB", // alias safety
  node: "VITE_API_BASE_NODE",
  nest: "VITE_API_BASE_NEST",
  django: "VITE_API_BASE_DJANGO",
  fastapi: "VITE_API_BASE_FASTAPI",
};

export function readBackendChoice(): string | null {
  try {
    const raw = localStorage.getItem("backendChoice");
    const v = raw ? String(raw).trim().toLowerCase() : "";
    return v || null;
  } catch {
    return null;
  }
}

function envBaseFor(kind: BackendKind): string | null {
  const key = BACKEND_ENV_MAP[String(kind ?? "").toLowerCase()] ?? null;
  if (!key) return null;

  // ✅ TS: import.meta.env is not indexable by arbitrary string unless we assert it
  const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
  const val = env[key];
  return val ? String(val) : null;
}

function fallbackBase(): string {
  return String(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api");
}

export function resolveApiBase(kind?: BackendKind | null): string {
  const base = envBaseFor(kind ?? "") || envBaseFor(readBackendChoice() ?? "") || fallbackBase();
  return String(base).replace(/\/+$/, "");
}

function defaultUseCredentials(kind?: BackendKind | null): boolean {
  const k = String(kind ?? "").toLowerCase();
  return k === "reverb" || k === "laravel";
}

/* ------------------------- axios instance ------------------------- */
const apiClient: AxiosInstance = axios.create({
  baseURL: resolveApiBase(readBackendChoice()),
  headers: { "Content-Type": "application/json" },
  withCredentials: defaultUseCredentials(readBackendChoice()),
});

let _store: AppStoreLike | null = null;

export function attachStore(store: AppStoreLike) {
  _store = store;
}

export function setApiBase(nextKind?: BackendKind | null): string {
  const nextBase = resolveApiBase(nextKind ?? undefined);
  apiClient.defaults.baseURL = nextBase;

  const creds = defaultUseCredentials(nextKind ?? undefined);
  apiClient.defaults.withCredentials = creds;

  if (DEBUG) {
    console.log("[apiClient] baseURL set =>", nextBase, {
      backend: nextKind,
      withCredentials: creds,
    });
  }
  return nextBase;
}

if (DEBUG) console.log("[apiClient] baseURL set =>", apiClient.defaults.baseURL);

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
    return (_store?.getState?.() as any)?.auth?.access_token || null;
  } catch {
    return null;
  }
}

/* ------------------------- request interceptor ------------------------- */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const cfg = config as InternalAxiosRequestConfig & AppAxiosRequestConfig;

    const chosen = readBackendChoice();
    const nextBase = resolveApiBase(chosen);

    // default: hasAuth=true for protected endpoints
    const hasAuth = cfg?.hasAuth !== false;

    const creds =
      typeof cfg?.withCredentials === "boolean"
        ? cfg.withCredentials
        : defaultUseCredentials(chosen);

    // sync defaults
    if (apiClient.defaults.baseURL !== nextBase) {
      apiClient.defaults.baseURL = nextBase;
      if (DEBUG) console.log("[apiClient] baseURL set =>", nextBase, { backend: chosen });
    }
    if (apiClient.defaults.withCredentials !== creds) {
      apiClient.defaults.withCredentials = creds;
      if (DEBUG) console.log("[apiClient] withCredentials =>", creds, { backend: chosen });
    }

    cfg.baseURL = nextBase;
    cfg.withCredentials = creds;

    // headers (axios v1)
    cfg.headers = cfg.headers || ({} as any);
    const h = cfg.headers as Record<string, any>;

    if (!h.Accept) h.Accept = "application/json";
    if (!h["Content-Type"]) h["Content-Type"] = "application/json";

    // attach token only when hasAuth=true
    if (hasAuth) {
      const token = getReduxToken();
      if (token && !h.Authorization) {
        h.Authorization = `Bearer ${String(token).replace(/^Bearer\s+/i, "").trim()}`;
      }
    } else {
      if (h.Authorization) delete h.Authorization;
    }

    // normalize url
    if (cfg?.url) {
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
      console.log("[apiClient] request error", { message: err?.message, code: err?.code });
    }
    return Promise.reject(err);
  }
);

/* ------------------------- response interceptor ------------------------- */
apiClient.interceptors.response.use(
  (res: AxiosResponse) => {
    if (DEBUG) console.log("[apiClient] <-", { status: res.status, url: buildFullUrl(res.config) });
    return res;
  },
  (err: AxiosError) => {
    if (isCanceled(err)) return Promise.reject(err);

    const status = err?.response?.status;
    const url = buildFullUrl(((err as any)?.config || {}) as AxiosRequestConfig);
    const code = (err as any)?.code;

    if (isNetworkDown(err)) {
      console.log("[apiClient] NETWORK DOWN", { url, code, message: err.message });
      return Promise.reject(err);
    }

    console.log("[apiClient] xx", {
      message: err.message,
      code,
      status,
      url,
      data: (err.response as any)?.data,
    });

    return Promise.reject(err);
  }
);

export default apiClient;

/* ------------------------- Data-only helpers ------------------------- */
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
      return { promise, cancel: () => controller.abort() };
    },

    post: <T = any>(url: string, data?: any, config: AppAxiosRequestConfig = {}) => {
      const controller = new AbortController();
      const promise = apiClient
        .post(url, data, { ...config, signal: controller.signal } as any)
        .then((r) => r.data as T);
      return { promise, cancel: () => controller.abort() };
    },
  },
};