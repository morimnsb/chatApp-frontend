import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Form, Button, Alert, Container } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../store/authStore';
import './LoginForm.css';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    // front-side validation
    if (!email || !password) {
      setError('All fields are required');
      return;
    }

    // start loading
    dispatch({ type: 'auth/loading', payload: true });

    // helpful debug snapshot
    setDebugInfo(
      `Attempting login with email=${email} (password length ${password.length})`,
    );

    try {
      // ----- REQUEST -----
      const response = await axios.post(
        'http://localhost:8000/api/auth/login/',
        { email, password },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      // log full response for debug
      console.log('[LOGIN SUCCESS RAW RESPONSE]', response);

      // also store it in state so we can render if something weird happens
      setDebugInfo(
        `status=${response.status}, data=${JSON.stringify(response.data)}`,
      );

      // ----- SUCCESS PATH -----
      if (response.status === 200) {
        const { full_name, access_token, refresh_token } = response.data || {};

        // sanity check that backend gave us what we expect
        if (!full_name || !access_token) {
          // backend answered 200 but body isn't what we expect
          setError('Invalid response from server (missing token or name)');
          dispatch({ type: 'auth/loading', payload: false });
          return;
        }

        // clear any previous error
        setError('');

        // update redux
        dispatch(
          login({
            user: { full_name },
            token: access_token,
            refresh_token,
          }),
        );

        // persist token for later API calls
        localStorage.setItem('access_token', access_token);

        toast.success('Login successful');

        // stop loading BEFORE navigating to avoid flicker race
        dispatch({ type: 'auth/loading', payload: false });

        // go home
        navigate('/');
        return;
      }

      // if we got here, response.status wasn't 200
      setError(`Unexpected status from server: ${response.status}`);
      dispatch({ type: 'auth/loading', payload: false });
    } catch (err) {
      console.error('[LOGIN ERROR]', err);

      // build a helpful debug string
      let dbg = 'Unknown error';
      if (err.response) {
        dbg = `status=${err.response.status}, data=${JSON.stringify(
          err.response.data,
        )}`;
      } else if (err.request) {
        dbg = 'No response (network or CORS)';
      } else {
        dbg = `Setup error: ${err.message}`;
      }
      setDebugInfo(dbg);

      // user-facing error message
      if (err.response && err.response.data) {
        // backend explicit detail (our LegacyAuthController returns { detail: "..." })
        if (err.response.data.detail) {
          setError(err.response.data.detail);
        } else {
          // e.g. validation object or unexpected JSON
          setError(JSON.stringify(err.response.data));
        }
      } else {
        // network / CORS / something else
        setError('Server error');
      }

      dispatch({ type: 'auth/loading', payload: false });
    }
  };

  return (
    <Container className="loginForm-container">
      <h3 className="loginForm-heading-welcome">Welcome Back!</h3>

      <Form onSubmit={handleLogin}>
        <h4 className="loginForm-loginNow">Log in Now:</h4>

        {/* user-facing error */}
        {error && <Alert variant="danger">{error}</Alert>}

        {/* developer debug info (show always for now while we're fixing) */}
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

        <Form.Group controlId="formEmail">
          <Form.Label className="loginForm-required-label">
            Email address
          </Form.Label>
          <Form.Control
            className="loginForm-required-control"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="Enter email"
            required
          />
        </Form.Group>

        <Form.Group controlId="formPassword">
          <Form.Label className="loginForm-required-label">Password</Form.Label>
          <Form.Control
            className="loginForm-required-control"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Password"
            required
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

      <div className="loginForm-dontHaveAccount-container">
        <p className="loginForm-dontHaveAccount">
          Don't have an account?{' '}
          <Link to="/register" className="registerForm-login-link">
            Sign Up
          </Link>
        </p>
      </div>
    </Container>
  );
};

export default LoginPage;
