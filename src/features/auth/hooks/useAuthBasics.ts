// chatApp-frontend\src\features\auth\hooks\useAuthBasics.ts
import { useMemo } from "react";
import { useAppSelector } from "@/app/store/hooks";
import type { RootState } from "@/app/store/store";

const stripBearer = (t: unknown): string =>
  String(t || "").replace(/^Bearer\s+/i, "");

export function useAuthBasics() {
  // 🔐 access token
  const accessToken = useAppSelector((s: RootState) =>
    s.auth?.access_token ?? (s.auth as any)?.token ?? ""
  );

  // 👤 current user (multi-backend safe fallback)
  const currentUser = useAppSelector((s: RootState) =>
    s.auth?.currentUser ??
    (s.auth as any)?.user ??
    (s.messages as any)?.currentUser ??
    null
  );

  // 🆔 extract user id safely
  const currentUserId = useMemo(() => {
    if (!currentUser) return null;

    return (
      (currentUser as any)?.id ??
      (currentUser as any)?.user_id ??
      (currentUser as any)?.userId ??
      (currentUser as any)?.pk ??
      null
    );
  }, [currentUser]);

  const bareToken = useMemo(() => stripBearer(accessToken), [accessToken]);

  return {
    bareToken,
    currentUser,
    currentUserId,
  } as const;
}