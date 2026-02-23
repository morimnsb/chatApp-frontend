// // chatApp-frontend/src/features/chat/hooks/useReverbRoom.ts
// import { useEffect, useRef } from "react";
// import { getOrCreateEcho } from "@/features/chat/reverb/echo"; // همون جایی که Echo می‌سازی

// import type { IncomingPacket } from "@/features/chat/components/ChatWindow";

// type Args = {
//   enabled: boolean;               // isReverb && hasToken
//   bareToken: string | null | undefined;
//   roomId: number | null;
//   onPacket: (p: IncomingPacket) => void;
// };

// export default function useReverbRoom({ enabled, bareToken, roomId, onPacket }: Args) {
//   const prevRoomRef = useRef<number | null>(null);

//   useEffect(() => {
//     if (!enabled || !bareToken) return;

//     const echo = getOrCreateEcho(bareToken);

//     const prev = prevRoomRef.current;
//     if (prev && prev !== roomId) {
//       // leave old
//       try {
//         echo.leave(`chat.${prev}`);
//         echo.leave(`private-chat.${prev}`); // safe fallback
//       } catch {}
//       prevRoomRef.current = null;
//     }

//     if (!roomId) return;

//     // join new
//     prevRoomRef.current = roomId;

//     const ch = echo.private(`chat.${roomId}`);

//     const onTyping = (payload: any) =>
//       onPacket({
//         type: "typing",
//         ...payload,
//       });

//     const onMsg = (payload: any) =>
//       onPacket({
//         type: "message",
//         message: payload?.message ?? payload,
//       });

//     // ✅ مثل Node: فقط packet بده
//     ch.listen(".chat.typing", onTyping);
//     ch.listen(".chat.message", onMsg); // اگر برای پیام هم event داری

//     // debug (optional)
//     ch.subscribed(() => console.log("[ReverbRoom] subscribed", roomId));
//     ch.error((e: any) => console.log("[ReverbRoom] error", roomId, e));

//     return () => {
//       try {
//         echo.leave(`chat.${roomId}`);
//         echo.leave(`private-chat.${roomId}`);
//       } catch {}
//     };
//   }, [enabled, bareToken, roomId, onPacket]);
// }