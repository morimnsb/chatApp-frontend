// chatApp-frontend\src\features\auth\components\ForgotPasswordForm.tsx
import React, { useState } from "react";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { forgotPasswordApi } from "@/shared/services/authService";

type ForgotPasswordPayload = {
  email: string;
};

type ForgotPasswordResponse = {
  message?: string;
  email?: string;
  token?: string;
};

function errMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;

  if (typeof err === "object") {
    const e = err as any;
    return (
      e?.response?.data?.message ||
      e?.response?.data?.detail ||
      e?.message ||
      "Unknown error"
    );
  }
  return "Unknown error";
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setError("ایمیل الزامی است.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload: ForgotPasswordPayload = { email: trimmed };

      const data: ForgotPasswordResponse = await forgotPasswordApi(payload);

      console.debug("[FORGOT PASSWORD RESPONSE]", data);

      if (data?.token) {
        localStorage.setItem("reset_email", data.email || trimmed);
        localStorage.setItem("reset_token", data.token);
      }

      toast.success(
        data?.message || "اگر ایمیلی ثبت شده باشد، کد/لینک ریست برای شما ارسال می‌شود."
      );

      navigate("/reset-password");
    } catch (err: unknown) {
      console.error("[FORGOT PASSWORD ERROR]", err);

      const msg = errMessage(err);
      setError("خطا در ارسال درخواست ریست رمز. بعداً دوباره تلاش کنید.");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-md-center">
        <Col xs={12} md={6}>
          <h4>فراموشی رمز عبور</h4>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formForgotEmail" className="mb-3">
              <Form.Label>ایمیل</Form.Label>
              <Form.Control
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "در حال ارسال…" : "ارسال لینک/کد ریست"}
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}