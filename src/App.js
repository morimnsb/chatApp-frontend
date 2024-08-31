import React from 'react';
import { Provider } from 'react-redux';
import store from './store/store';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Register from './components/RegisterForm/RegisterForm';
import VerifyEmail from './components/VerifyEmail/VerifyEmail';
import LoginPage from './components/auth/LoginForm';
import HomeChat from './components/HomeChat';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

export const AuthContext = React.createContext();

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeChat />} />
          </Route>
          {/* Redirect to login if no other routes match */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
