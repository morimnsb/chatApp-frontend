// src/components/auth/LoginForm.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Button, Alert, Container } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

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
  const status = useSelector(selectAuthStatus); // 'idle' | 'loading' | 'succeeded' | 'failed'
  const loading = status === 'loading';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (isLoggedIn) navigate('/');
  }, [isLoggedIn, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('All fields are required');
      return;
    }
    setError('');
    setDebugInfo(`Dispatch loginThunk email=${email} (len=${password.length})`);

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
      <h3 className="loginForm-heading-welcome">Welcome Back!</h3>

      <Form onSubmit={handleLogin}>
        <h4 className="loginForm-loginNow">Log in Now:</h4>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        {/* برای دیباگ حین مهاجرت؛ اگر نمی‌خواهی حذفش کن */}
        <Alert variant="secondary" style={{ fontSize: '0.8rem' }}>
          <div>
            <strong>Debug:</strong>
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
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
