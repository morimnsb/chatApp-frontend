// src/components/auth/ResetPasswordForm.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { resetPasswordApi } from '@/shared/services/authService';
import { useNavigate } from 'react-router-dom';

export default function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const e = localStorage.getItem('reset_email');
    const t = localStorage.getItem('reset_token');
    if (e) setEmail(e);
    if (t) setToken(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !token || !password || !password2) {
      setError('همه فیلدها الزامی هستند.');
      return;
    }
    if (password !== password2) {
      setError('رمز جدید و تکرار آن یکسان نیستند.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = await resetPasswordApi({
        email,
        token,
        password,
        password2,
      });

      console.debug('[RESET PASSWORD RESPONSE]', data);

      toast.success(data?.message || 'رمز عبور با موفقیت ریست شد.');

      // پاک کردن مقادیر dev
      localStorage.removeItem('reset_email');
      localStorage.removeItem('reset_token');

      navigate('/login');
    } catch (err) {
      console.error('[RESET PASSWORD ERROR RAW]', err);
      const resp = err?.response;
      const data = resp?.data;

      let message = 'خطا در ریست رمز عبور.';

      if (data?.message) {
        message = data.message;
      } else if (resp?.status === 422) {
        message = 'ایمیل یا توکن نامعتبر است، یا اعتبار آن تمام شده است.';
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
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formResetEmail" className="mb-3">
              <Form.Label>ایمیل</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Form.Group controlId="formResetToken" className="mb-3">
              <Form.Label>توکن / کد ریست</Form.Label>
              <Form.Control
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group controlId="formNewPassword" className="mb-3">
              <Form.Label>رمز عبور جدید</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                onChange={(e) => setPassword2(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'در حال ارسال…' : 'ذخیره رمز جدید'}
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}

