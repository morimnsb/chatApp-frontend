import { useMemo } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';

export const useFormattedTime = (timestamp) => {
  return useMemo(() => {
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
  }, [timestamp]);
};

export const useFormattedMessages = (messages) => {
  return useMemo(() => {
    return messages.map((msg) => {
      const timestamp = msg.last_message?.timestamp;
      let formattedTime = '';

      if (timestamp) {
        try {
          const date = parseISO(timestamp);
          if (isToday(date)) {
            formattedTime = format(date, 'hh:mm a');
          } else if (isYesterday(date)) {
            formattedTime = `Yesterday at ${format(date, 'hh:mm a')}`;
          } else {
            formattedTime = format(date, 'MMM d, yyyy, hh:mm a');
          }
        } catch (error) {
          console.error('Error formatting timestamp:', error);
          formattedTime = 'Invalid date';
        }
      }

      return { ...msg, formattedTime };
    });
  }, [messages]);
};
