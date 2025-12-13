import { createSelector } from '@reduxjs/toolkit';
import { messagesSelectors } from '@/store/messageSlice';

export const selectMessagesByRoom = (roomId) =>
  createSelector([messagesSelectors.selectAll], (all) =>
    all.filter((m) => m.roomId === roomId),
  );
