import React from 'react';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { store } from '@/app/store/store';

export default function AppProviders({ children }) {
  return (
    <Provider store={store}>
      {children}
      <ToastContainer position="top-right" autoClose={2500} newestOnTop />
    </Provider>
  );
}
