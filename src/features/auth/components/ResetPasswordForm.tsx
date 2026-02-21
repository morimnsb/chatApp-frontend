// chatApp-frontend\src\features\auth\components\ResetPasswordForm.tsx
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { resetPasswordApi } from "@/shared/services/authService";

type ResetPasswordPayload = {
  email: string;
  token: string;
  password: string;
  password2: string;
};

type ResetPasswordResponse = {
  message?: string;
  [k: string]: any;
};

type AxiosLikeError = {
  response?: {
    status?: number;
    data?: any;
  };
  message?: string;
};

export default function ResetPasswordForm() {
  const [email, setEmail] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [password2, setPassword2] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const navigate = useNavigate();

  useEffect(() => {
    const e = localStorage.getItem("reset_email");
    const t = localStorage.getItem("reset_token");
    if (e) setEmail(e);
    if (t) setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !token || !password || !password2) {
      const msg = "همه فیلدها الزامی هستند.";
      setError(msg);
      return;
    }
    if (password !== password2) {
      const msg = "رمز جدید و تکرار آن یکسان نیستند.";
      setError(msg);
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload: ResetPasswordPayload = { email, token, password, password2 };

      const data = (await resetPasswordApi(payload)) as ResetPasswordResponse;

      console.debug("[RESET PASSWORD RESPONSE]", data);

      toast.success(data?.message || "رمز عبور با موفقیت ریست شد.");

      localStorage.removeItem("reset_email");
      localStorage.removeItem("reset_token");

      navigate("/login");
    } catch (err) {
      const e = err as AxiosLikeError;

      console.error("[RESET PASSWORD ERROR RAW]", e);

      const resp = e?.response;
      const data = resp?.data;

      let message = "خطا در ریست رمز عبور.";

      if (data?.message) {
        message = String(data.message);
      } else if (resp?.status === 422) {
        message = "ایمیل یا توکن نامعتبر است، یا اعتبار آن تمام شده است.";
      } else if (e?.message) {
        // fallback برای errorهای شبکه‌ای
        message = e.message;
      }

      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-md-center">
        <Col xs={12} md={6}>
          <h4>ریست رمز عبور</h4>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formResetEmail" className="mb-3">
              <Form.Label>ایمیل</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Form.Group controlId="formResetToken" className="mb-3">
              <Form.Label>توکن / کد ریست</Form.Label>
              <Form.Control
                type="text"
                value={token}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group controlId="formNewPassword" className="mb-3">
              <Form.Label>رمز عبور جدید</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Form.Group controlId="formNewPassword2" className="mb-3">
              <Form.Label>تکرار رمز عبور جدید</Form.Label>
              <Form.Control
                type="password"
                value={password2}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword2(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "در حال ارسال…" : "ذخیره رمز جدید"}
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}