// chatApp-frontend/src/features/chat/hooks/useRoomResetOnBackendChange.ts
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { selectRoom } from "@/features/chat/state/messageActions";

type Params = {
  effectiveKind: string;
  bareToken?: string | null;
  setRoomId: (v: number | null) => void;
};

export default function useRoomResetOnBackendChange({
  effectiveKind,
  bareToken,
  setRoomId,
}: Params) {
  const dispatch = useDispatch();

  const prevRef = useRef<{ kind: string | null; sig: string }>({ kind: null, sig: "" });

  useEffect(() => {
    const sig = bareToken ? `t:${bareToken.length}` : "t:0";
    const prev = prevRef.current;

    if (prev.kind !== effectiveKind || prev.sig !== sig) {
      prevRef.current = { kind: effectiveKind, sig };
      setRoomId(null);
      dispatch(selectRoom(null));
    }
  }, [effectiveKind, bareToken, dispatch, setRoomId]);
}