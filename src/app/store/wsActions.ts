// chatApp-frontend\src\app\store\wsActions.ts
import { createAction } from "@reduxjs/toolkit";
import type { BackendKey } from "@/shared/backend";

/**
 * WebSocket backend type:
 * - "reverb"
 * - "node"
 * - "django"
 * - "none" (no realtime)
 */
export type WsBackendKey = BackendKey | "none";

/* ------------------ connection lifecycle ------------------ */

export const wsConnected = createAction("ws/connected");

export const wsDisconnected = createAction("ws/disconnected");

/* ------------------ data ------------------ */

export const wsMessage = createAction<unknown>("ws/message");

export const wsError = createAction<string | null>("ws/error");

/* ------------------ outgoing ------------------ */

export const wsSend = createAction<unknown>("ws/send");

/* ------------------ backend selection ------------------ */

// store current realtime backend (reverb/node/none)
export const wsSetBackend = createAction<WsBackendKey | null>("ws/setBackend");