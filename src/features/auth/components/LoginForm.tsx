// chatApp-frontend/src/features/auth/components/LoginForm.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import { Form, Button, Alert, Container } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

import apiClient from "@/shared/api/apiClient";
import { apiSlice } from "@/shared/api/apiSlice";
import { loginThunk, selectAuthStatus, selectIsLoggedIn } from "@/app/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";

import "./LoginForm.css";

type PingResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; code: string | null; message: string };

async function pingHealth(): Promise<PingResult> {
  try {
    const res = await apiClient.get("/health");
    return { ok: true, status: res.status };
  } catch (e: any) {
    return {
      ok: false,
      status: e?.response?.status ?? null,
      code: e?.code ?? null,
      message: e?.message || String(e),
    };
  }
}

function getStoredBackendChoice(): string | null {
  try {
    const raw = localStorage.getItem("backendChoice");
    const safe = raw ? String(raw).trim().toLowerCase() : "";
    return safe || null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isLoggedIn = useAppSelector(selectIsLoggedIn);
  const status = useAppSelector(selectAuthStatus);
  const loading = status === "loading";

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !password) {
      setError("All fields are required");
      return;
    }

    setError("");

    // ✅ reset RTK Query cache to avoid stale API base / headers issues
    dispatch(apiSlice.util.resetApiState());

    const baseURL: string = (apiClient as any)?.defaults?.baseURL || "(no baseURL)";
    setDebugInfo(
      `Login attempt:\n` +
        `storedChoice=${getStoredBackendChoice() || "n/a"}\n` +
        `apiClient.baseURL=${baseURL}\n` +
        `POST ${String(baseURL).replace(/\/+$/, "")}/auth/login\n` +
        `email=${email} (pwLen=${password.length})`
    );

    // ✅ health check فقط هشدار بده، بلاک نکن
    const ping = await pingHealth();
    setDebugInfo((prev) => {
      const msg = ping.ok ? "" : ping.message ?? "";
      const code = ping.ok ? "n/a" : ping.code ?? "n/a";
      const statusText = ping.status ?? "n/a";

      return (
        `${prev}\n\nPING /health:\n` +
        `ok=${ping.ok}\n` +
        `status=${statusText}\n` +
        `code=${code}\n` +
        `msg=${msg}`
      );
    });

    if (!ping.ok) {
      toast.warn("Backend health check failed (server may be down). Trying login anyway...");
    }

    // ✅ مسیر تمیزتر: unwrap (throw می‌کنه روی reject)
    try {
      await dispatch(loginThunk({ email, password })).unwrap();
      toast.success("Login successful");
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "Login failed";
      setError(msg);
      setDebugInfo((prev) => `${prev}\n\nLOGIN FAILED:\n${String(msg)}`);
    }
  };

  return (
    <Container className="loginForm-container" style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.8 }}>
        Backend: <strong>{getStoredBackendChoice() || "n/a"}</strong>{" "}
        <Link
          to="/choose-backend"
          style={{ marginLeft: 8, textDecoration: "underline" }}
        >
          Change backend
        </Link>
      </div>

      <h3 className="loginForm-heading-welcome">Welcome Back!</h3>

      <Form onSubmit={handleLogin}>
        <h4 className="loginForm-loginNow">Log in Now:</h4>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Alert variant="secondary" style={{ fontSize: "0.8rem" }}>
          <div>
            <strong>Debug:</strong>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {debugInfo || "no debug yet"}
          </pre>
        </Alert>

        <Form.Group controlId="formEmail" className="mb-3">
          <Form.Label className="loginForm-required-label">Email address</Form.Label>
          <Form.Control
            className="loginForm-required-control"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
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
              if (error) setError("");
            }}
            placeholder="Password"
            required
            autoComplete="current-password"
          />
          <Link className="loginForm-forgot-password-link" to="/forgot-password">
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

      <div className="d-flex justify-content-between mt-3">
        <span>
          حساب ندارید؟{" "}
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
}