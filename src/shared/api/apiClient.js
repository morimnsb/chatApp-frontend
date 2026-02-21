import axios from "axios";

/* ------------------------- URL helpers ------------------------- */
const ABSOLUTE_RE = /^(?:https?:)?\/\//i;
const isAbsoluteUrl = (u) => ABSOLUTE_RE.test(String(u || ""));

function normalizeUrl(path) {
  const p = String(path || "").trim();
  if (!p) return null;
  if (isAbsoluteUrl(p)) return p;
  const cleaned = p.replace(/^\/+/, "").replace(/\s+/g, "");
  return `/${cleaned}`;
}

function buildFullUrl(config) {
  const base = String(config?.baseURL || "").replace(/\/+$/, "");
  const url = String(config?.url || "");
  if (isAbsoluteUrl(url)) return url;
  const path = url.replace(/^\/+/, "");
  return base ? `${base}/${path}` : `/${path}`;
}

/* ------------------------- ENV ------------------------- */
const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";

/* ------------------------- backend -> env map ------------------------- */
const BACKEND_ENV_MAP = {
  reverb: "VITE_API_BASE_REVERB",
  laravel: "VITE_API_BASE_REVERB", // alias safety
  node: "VITE_API_BASE_NODE",
  nest: "VITE_API_BASE_NEST",
  django: "VITE_API_BASE_DJANGO",
  fastapi: "VITE_API_BASE_FASTAPI",
};

export function readBackendChoice() {
  try {
    const raw = localStorage.getItem("backendChoice");
    const v = raw ? String(raw).trim().toLowerCase() : "";
    return v || null;
  } catch {
    return null;
  }
}

function envBaseFor(kind) {
  const key = BACKEND_ENV_MAP[String(kind || "").toLowerCase()] || null;
  if (!key) return null;
  const val = import.meta.env[key];
  return val ? String(val) : null;
}

function fallbackBase() {
  return String(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api");
}

export function resolveApiBase(kind) {
  const base = envBaseFor(kind) || envBaseFor(readBackendChoice()) || fallbackBase();
  return String(base).replace(/\/+$/, "");
}

function defaultUseCredentials(kind) {
  // only laravel/reverb might use cookies for broadcast auth, but our auth is JWT
  const k = String(kind || "").toLowerCase();
  return k === "reverb" || k === "laravel";
}

/* ------------------------- axios instance ------------------------- */
const apiClient = axios.create({
  baseURL: resolveApiBase(readBackendChoice()),
  headers: { "Content-Type": "application/json" },
  withCredentials: defaultUseCredentials(readBackendChoice()),
});

let _store = null;
export function attachStore(store) {
  _store = store;
}

export function setApiBase(nextKind) {
  const nextBase = resolveApiBase(nextKind);
  apiClient.defaults.baseURL = nextBase;

  const creds = defaultUseCredentials(nextKind);
  apiClient.defaults.withCredentials = creds;

  if (DEBUG) console.log("[apiClient] baseURL set =>", nextBase, { backend: nextKind, withCredentials: creds });
  return nextBase;
}

if (DEBUG) console.log("[apiClient] baseURL set =>", apiClient.defaults.baseURL);

/* ------------------------- cancel / network detection ------------------------- */
export const isCanceled = (err) =>
  err?.code === "ERR_CANCELED" ||
  err?.name === "CanceledError" ||
  err?.name === "AbortError" ||
  String(err?.message || "").toLowerCase().includes("canceled") ||
  axios.isCancel?.(err) === true;

const isNetworkDown = (err) =>
  err?.code === "ERR_NETWORK" ||
  err?.code === "ECONNABORTED" ||
  /Network Error/i.test(String(err?.message || ""));

function getReduxToken() {
  try {
    return _store?.getState?.().auth?.access_token || null;
  } catch {
    return null;
  }
}

/* ------------------------- request interceptor ------------------------- */
apiClient.interceptors.request.use(
  (config) => {
    const chosen = readBackendChoice();
    const nextBase = resolveApiBase(chosen);

    // ✅ per-request controls (standard)
    // default: hasAuth=true for protected endpoints, but auth endpoints should pass { hasAuth:false }
    const hasAuth = config?.hasAuth !== false; // default true
    const creds = typeof config?.withCredentials === "boolean"
      ? config.withCredentials
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

    config.baseURL = nextBase;
    config.withCredentials = creds;

    // headers
    config.headers = config.headers || {};
    if (!config.headers.Accept) config.headers.Accept = "application/json";
    if (!config.headers["Content-Type"]) config.headers["Content-Type"] = "application/json";

    // ✅ attach token only when hasAuth=true
    if (hasAuth) {
      const token = getReduxToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${String(token).replace(/^Bearer\s+/i, "").trim()}`;
      }
    } else {
      // ensure no auth header leaks
      if (config.headers.Authorization) delete config.headers.Authorization;
    }

    // normalize url
    if (config?.url) {
      const nu = normalizeUrl(config.url);
      if (nu) config.url = nu;
    }

    if (DEBUG) {
      console.log("[apiClient] ->", {
        backend: chosen,
        baseURL: nextBase,
        method: (config.method || "get").toUpperCase(),
        url: buildFullUrl(config),
        hasAuth: Boolean(config.headers.Authorization),
        withCredentials: Boolean(config.withCredentials),
        hasAuthFlag: hasAuth,
      });
    }

    return config;
  },
  (err) => {
    if (!isCanceled(err)) console.log("[apiClient] request error", { message: err?.message, code: err?.code });
    return Promise.reject(err);
  }
);

/* ------------------------- response interceptor ------------------------- */
apiClient.interceptors.response.use(
  (res) => {
    if (DEBUG) console.log("[apiClient] <-", { status: res.status, url: buildFullUrl(res.config) });
    return res;
  },
  (err) => {
    if (isCanceled(err)) return Promise.reject(err);

    const status = err?.response?.status;
    const url = buildFullUrl(err?.config || {});
    const code = err?.code;

    if (isNetworkDown(err)) {
      console.log("[apiClient] NETWORK DOWN", { url, code, message: err?.message });
      return Promise.reject(err);
    }

    console.log("[apiClient] xx", {
      message: err?.message,
      code,
      status,
      url,
      data: err?.response?.data,
    });

    return Promise.reject(err);
  }
);

export default apiClient;

/* ------------------------- Data-only helpers ------------------------- */
export const http = {
  request: (config) => apiClient.request(config).then((r) => r.data),

  get: (url, config) => apiClient.get(url, config).then((r) => r.data),
  post: (url, data, config) => apiClient.post(url, data, config).then((r) => r.data),
  put: (url, data, config) => apiClient.put(url, data, config).then((r) => r.data),
  patch: (url, data, config) => apiClient.patch(url, data, config).then((r) => r.data),
  delete: (url, config) => apiClient.delete(url, config).then((r) => r.data),

  cancelable: {
    get: (url, config = {}) => {
      const controller = new AbortController();
      const promise = apiClient.get(url, { ...config, signal: controller.signal }).then((r) => r.data);
      return { promise, cancel: () => controller.abort() };
    },
    post: (url, data, config = {}) => {
      const controller = new AbortController();
      const promise = apiClient.post(url, data, { ...config, signal: controller.signal }).then((r) => r.data);
      return { promise, cancel: () => controller.abort() };
    },
  },
};