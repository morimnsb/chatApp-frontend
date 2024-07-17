import React, { useState, useContext } from 'react';
import { Provider } from 'react-redux';
import store from './store/store.js';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Register from './components/RegisterForm/RegisterForm.js';
import VerifyEmail from './components/VerifyEmail/VerifyEmail';
import LoginPage from './components/auth/LoginForm';
import MessagesList from './components/MessagesList';
import ProtectedRoute from './components/ProtectedRoute.js';

import './App.css';

export const AuthContext = React.createContext();

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = () => {
    setIsLoggedIn(true);
    console.log('User logged in');
  };

  const logout = () => {
    setIsLoggedIn(false);
    console.log('User logged out');
  };

  console.log('Rendering App component');

  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MessagesList />} />
          </Route>
          {/* Redirect to login if no other routes match */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
