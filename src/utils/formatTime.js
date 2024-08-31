// src/utils/formatTime.js
import { format, parseISO, isToday, isYesterday } from 'date-fns';

export const formatTime = (timestamp) => {
  if (!timestamp) return '';

  try {
    const date = parseISO(timestamp);
    if (isToday(date)) {
      return format(date, 'hh:mm a');
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'hh:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy, hh:mm a');
    }
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
};
