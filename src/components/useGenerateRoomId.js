import { useCallback } from 'react';

const useGenerateRoomId = (currentUser, handleSelectChat) => {
  return useCallback(
    (receiverId) => {
      try {
        const receiverIdStr = String(receiverId);
        const currentUserIdStr = String(currentUser);
        console.log(receiverIdStr, currentUserIdStr);
        const { BigInt } = window;
        const bigintReceiver = BigInt(`0x${receiverIdStr.replace(/-/g, '')}`);
        const bigintCurrentUser = BigInt(
          `0x${currentUserIdStr.replace(/-/g, '')}`,
        );
        const xorResult = bigintReceiver ^ bigintCurrentUser;
        const xorResultHex = xorResult.toString(16).padStart(32, '0'); // Ensure full length
        const roomId = `${xorResultHex.substr(0, 8)}-${xorResultHex.substr(
          8,
          4,
        )}-${xorResultHex.substr(12, 4)}-${xorResultHex.substr(
          16,
          4,
        )}-${xorResultHex.substr(20)}`;
        handleSelectChat(roomId, receiverIdStr);
      } catch (error) {
        console.error('Error generating room ID:', error);
      }
    },
    [currentUser, handleSelectChat],
  );
};

export default useGenerateRoomId;
