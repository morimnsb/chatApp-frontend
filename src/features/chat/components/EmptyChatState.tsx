// chatApp-frontend/src/features/chat/components/EmptyChatState.tsx
import React from "react";

export default function EmptyChatState() {
  return (
    <div
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        border: "1px dashed rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 24,
        opacity: 0.9,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>هیچ چتی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}