// chatApp-frontend/src/features/chat/utils/toUiBackendKind.ts
import type { UiBackendKind } from "@/features/chat/types/homeChat";

export default function toUiBackendKind(v: unknown): UiBackendKind {
  const k = String(v ?? "").toLowerCase();
  return k === "reverb" || k === "node" || k === "django" ? (k as UiBackendKind) : undefined;
}