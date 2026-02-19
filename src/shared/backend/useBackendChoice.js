import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { BACKENDS } from "./index"; // یا مسیر درست خودت

const LS_KEY = "backendChoice";

const readLS = () => {
  try {
    const v = (localStorage.getItem(LS_KEY) || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
};

const writeLS = (v) => {
  try {
    localStorage.setItem(LS_KEY, String(v || "").trim().toLowerCase());
  } catch {}
};

const normalize = (v) => {
  const k = String(v || "").trim().toLowerCase();
  return BACKENDS.includes(k) ? k : null;
};

export function useBackendChoice() {
  // ✅ اگر backendSlice داری اینجا بخون، اگر نداری هم مهم نیست
  const reduxKey =
    useSelector((s) => s.backend?.key || s.backend?.backendKey || null);

  // ✅ local state (for instant UI)
  const [uiKey, setUiKey] = useState(() => normalize(readLS()) || normalize(reduxKey) || "reverb");

  // ✅ sync when redux changes
  useEffect(() => {
    const nk = normalize(reduxKey);
    if (nk && nk !== uiKey) setUiKey(nk);
  }, [reduxKey]); // intentionally not uiKey in deps

  const effectiveKind = useMemo(() => {
    return normalize(uiKey) || normalize(readLS()) || normalize(reduxKey) || "reverb";
  }, [uiKey, reduxKey]);

  const handleChangeBackend = useCallback((next) => {
    const nk = normalize(next) || "reverb";
    setUiKey(nk);
    writeLS(nk);
  }, []);

  return {
    backendChoice: uiKey,        // برای select
    effectiveKind,              // برای logic
    handleChangeBackend,        // برای تغییر
  };
}
