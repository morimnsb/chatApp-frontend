import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Button, Alert, Container } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

import BackendPicker from '@/components/BackendPicker';
import { useBackendChoice } from '@/backend/choice';
import { apiSlice } from '@/services/apiSlice';

import {
  loginThunk,
  selectAuthStatus,
  selectIsLoggedIn,
} from '@/store/authSlice';

import './LoginForm.css';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoggedIn = useSelector(selectIsLoggedIn);
  const status = useSelector(selectAuthStatus);
  const loading = status === 'loading';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const { backendChoice, effectiveKind, handleChangeBackend } = useBackendChoice();

  useEffect(() => {
    if (isLoggedIn) navigate('/');
  }, [isLoggedIn, navigate]);

  // ✅ wrapper: وقتی backend عوض شد، RTK Query cache ریست شود
  const onChangeBackend = useCallback(
  (nextValue) => {
    handleChangeBackend(nextValue);
    dispatch(apiSlice.util.resetApiState());
    setDebugInfo((prev) => `${prev}\nBackend switched to: ${nextValue}`);
  },
  [dispatch, handleChangeBackend],
);


  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('All fields are required');
      return;
    }

    setError('');
    setDebugInfo(`Dispatch loginThunk backend=${effectiveKind} email=${email} (len=${password.length})`);

    const action = await dispatch(loginThunk({ email, password }));

    if (loginThunk.fulfilled.match(action)) {
      toast.success('Login successful');
      navigate('/');
    } else {
      const msg = action.payload || 'Login failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setDebugInfo(String(msg));
    }
  };

  return (
    <Container className="loginForm-container" style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 12 }}>
        <BackendPicker value={backendChoice} onChange={onChangeBackend} />
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          Selected: <strong>{effectiveKind}</strong>
        </div>
      </div>

      <h3 className="loginForm-heading-welcome">Welcome Back!</h3>

      <Form onSubmit={handleLogin}>
        <h4 className="loginForm-loginNow">Log in Now:</h4>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Alert variant="secondary" style={{ fontSize: '0.8rem' }}>
          <div><strong>Debug:</strong></div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {debugInfo || 'no debug yet'}
          </pre>
        </Alert>

        <Form.Group controlId="formEmail" className="mb-3">
          <Form.Label className="loginForm-required-label">
            Email address
          </Form.Label>
          <Form.Control
            className="loginForm-required-control"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            placeholder="Enter email"
            required
            autoComplete="username"
          />
        </Form.Group>

        <Form.Group controlId="formPassword" className="mb-3">
          <Form.Label className="loginForm-required-label">Password</Form.Label>
          <Form.Control
            className="loginForm-required-control"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="Password"
            required
            autoComplete="current-password"
          />
          <Link
            className="loginForm-forgot-password-link"
            to="/forgot-password"
          >
            Forgot password
          </Link>
        </Form.Group>

        <Button
          className="loginForm-signin-button"
          variant="primary"
          type="submit"
          disabled={loading || !email || !password}
        >
          {loading ? 'Loading...' : 'Login'}
        </Button>
      </Form>

      <div className="d-flex justify-content-between mt-3">
        <span>
          حساب ندارید؟{' '}
          <Link to="/register" className="loginForm-register-link">
            ثبت‌نام
          </Link>
        </span>

        <Link to="/forgot-password" className="loginForm-forgot-link">
          رمز عبور را فراموش کرده‌اید؟
        </Link>
      </div>
    </Container>
  );
};

export default LoginPage;
