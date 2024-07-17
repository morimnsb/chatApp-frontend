import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Form, Button, Alert, Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../../store/authStore";
import "./LoginForm.css";

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("All fields are required");
      return;
    }

    dispatch({ type: "auth/loading", payload: true });

    try {
      const response = await axios.post(
        "http://localhost:8000/api/auth/login/",
        { email, password }
      );

      if (response.status === 200) {
        const { full_name, access_token, refresh_token } = response.data;

        dispatch(
          login({
            user: { full_name },
            token: access_token,
            refresh_token,
          })
        );
        localStorage.setItem("access_token", access_token);
        // Consider using secure storage for access_token
        toast.success("Login successful");
        navigate("/");
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.detail);
      } else {
        setError("Server error");
      }
    } finally {
      dispatch({ type: "auth/loading", payload: false });
    }
  };

  return (
    <Container className="loginForm-container">
      <h3 className="loginForm-heading-welcome">Welcome Back!</h3>
      <Form onSubmit={handleLogin}>
        <h4 className="loginForm-loginNow">Log in Now:</h4>
        {error && <Alert variant="danger">{error}</Alert>}
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
          {loading ? "Loading..." : "Login"}
        </Button>
      </Form>
      <div className="loginForm-dontHaveAccount-container">
        <p className="loginForm-dontHaveAccount">
          Don't have an account?
          <Link to="/register" className="registerForm-login-link">
            Sign Up
          </Link>
        </p>
      </div>
    </Container>
  );
};

export default LoginPage;
