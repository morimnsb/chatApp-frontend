// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authStore'; // Adjust the import path if necessary
import messageReducer from '../reducers/messageReducer'; // Correct import for default export

export default configureStore({
  reducer: {
    auth: authReducer,
    messages: messageReducer, // Add the message reducer here
  },
});
