import React from "react";
import { Outlet } from "react-router-dom";
import ChatRealtimeProvider from "./ChatRealtimeProvider";
import { useBackendChoice } from "@/shared/backend";

export default function ChatRealtimeLayout(): JSX.Element {
  const { effectiveKind } = useBackendChoice();

  return (
    <ChatRealtimeProvider effectiveKind={effectiveKind}>
      <Outlet />
    </ChatRealtimeProvider>
  );
}