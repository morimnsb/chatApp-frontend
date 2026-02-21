//chatApp-frontend\src\features\system\pages\ChooseBackendPage.tsx
import React, { useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  BACKENDS,
  BACKEND_REGISTRY,
  resolveApiBase,
  setChosenBackendNoReload,
  type BackendKey,
} from "@/shared/backend";

import { apiSlice } from "@/shared/api/apiSlice";
import { setApiBase } from "@/shared/api/apiClient";
import { setBackend } from "@/shared/backend/backendSlice";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";

type LocationState = {
  from?: string;
};

type Item = {
  key: BackendKey;
  label: string;
  apiBase: string;
  ws: string; // نمایشی
};

// ✅ add this (was missing)
const normalizeKey = (v: unknown): BackendKey | null => {
  const k = String(v ?? "").trim().toLowerCase();
  return (BACKENDS as readonly string[]).includes(k) ? (k as BackendKey) : null;
};

export default function ChooseBackendPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ do NOT force RootState here; if backend slice is still JS it can poison types
  const backendKeyRaw = useAppSelector((s) => s.backend?.key ?? null) as unknown;
  const backendKey = normalizeKey(backendKeyRaw);

  const from = ((location.state as LocationState | null)?.from || "/chat") as string;

  const items = useMemo<Item[]>(() => {
    return (BACKENDS as readonly BackendKey[])
      .map((k) => ({ key: k, b: BACKEND_REGISTRY[k] }))
      .map(({ key, b }) => ({
        key,
        label: b.label || key,
        apiBase: resolveApiBase(b),
        ws: b.ws?.kind || "none",
      }));
  }, []);

  const onPick = useCallback(
    (k: BackendKey) => {
      setChosenBackendNoReload(k);
      dispatch(setBackend(k));
      setApiBase(k);
      dispatch(apiSlice.util.resetApiState());
      navigate(from, { replace: true });
    },
    [dispatch, navigate, from]
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Choose your backend server</h1>
          <p style={styles.sub}>
            Select which server you want to use. You can change it later from Home/Settings.
          </p>
        </div>

        <div style={styles.list}>
          {items.map((it) => {
            const active = it.key === backendKey;

            return (
              <button
                key={it.key}
                onClick={() => onPick(it.key)}
                type="button"
                style={{
                  ...styles.item,
                  ...(active ? styles.itemActive : null),
                }}
              >
                <div style={styles.itemTop}>
                  <div>
                    <div style={styles.itemTitle}>{it.label}</div>

                    <div style={styles.itemMeta}>
                      API: <code style={styles.code}>{it.apiBase}</code>
                    </div>

                    <div style={styles.itemMeta}>
                      Realtime: <b>{it.ws}</b>
                    </div>
                  </div>

                  {active ? <span style={styles.badge}>Selected</span> : null}
                </div>

                <div style={styles.itemHint}>Click to use this backend</div>
              </button>
            );
          })}
        </div>

        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            {backendKey ? (
              <span>
                {/* ✅ now indexing is safe because backendKey is BackendKey here */}
                Current: <b>{BACKEND_REGISTRY[backendKey].label || backendKey}</b>
              </span>
            ) : (
              <span style={{ opacity: 0.8 }}>No backend selected yet</span>
            )}
          </div>

          <div style={styles.footerRight}>
            <Link to={from} style={styles.link}>
              Go to Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ typed inline styles
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  card: {
    width: "min(900px, 100%)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 16,
    padding: 20,
  },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 22 },
  sub: { margin: "6px 0 0", opacity: 0.75 },

  list: { display: "grid", gap: 12, marginTop: 14 },

  item: {
    width: "100%",
    textAlign: "left",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "transparent",
    cursor: "pointer",
  },
  itemActive: {
    borderColor: "rgba(0,0,0,0.35)",
  },

  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  itemTitle: { fontSize: 16, fontWeight: 800, marginBottom: 6 },
  itemMeta: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  itemHint: { marginTop: 10, fontSize: 12, opacity: 0.7 },

  badge: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(0,0,0,0.2)",
    height: "fit-content",
  },
  code: { fontSize: 12 },

  footer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "rgba(0,0,0,0.12)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  footerLeft: { fontSize: 13, opacity: 0.9 },
  footerRight: { display: "flex", gap: 10 },
  link: { fontSize: 13, textDecoration: "underline" },
};