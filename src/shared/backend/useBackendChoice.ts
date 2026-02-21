import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/app/store/hooks";
import { BACKENDS } from "./index";

const LS_KEY = "backendChoice";
type BackendKey = (typeof BACKENDS)[number];
type BackendKeyLoose = BackendKey | "reverb";

const readLS = (): string | null => {
  try {
    const v = (localStorage.getItem(LS_KEY) || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
};

const writeLS = (v: string | null | undefined): void => {
  try {
    localStorage.setItem(LS_KEY, String(v || "").trim().toLowerCase());
  } catch {}
};

const normalize = (v: unknown): BackendKey | null => {
  const k = String(v ?? "").trim().toLowerCase();
  return (BACKENDS as readonly string[]).includes(k) ? (k as BackendKey) : null;
};

export function useBackendChoice() {
  // ✅ فقط key
  const reduxKey = useAppSelector((s) => s.backend?.key ?? null);

  const [uiKey, setUiKey] = useState<BackendKeyLoose>(() => {
    return (
      normalize(readLS()) ??
      normalize(reduxKey) ??
      ("reverb" as BackendKeyLoose)
    );
  });

  useEffect(() => {
    const nk = normalize(reduxKey);
    if (nk && nk !== uiKey) setUiKey(nk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduxKey]);

  const effectiveKind = useMemo<BackendKeyLoose>(() => {
    return (
      normalize(uiKey) ??
      normalize(readLS()) ??
      normalize(reduxKey) ??
      ("reverb" as BackendKeyLoose)
    );
  }, [uiKey, reduxKey]);

  const handleChangeBackend = useCallback((next: unknown) => {
    const nk = normalize(next) ?? ("reverb" as BackendKeyLoose);
    setUiKey(nk);
    writeLS(nk);
  }, []);

  return { backendChoice: uiKey, effectiveKind, handleChangeBackend } as const;
}