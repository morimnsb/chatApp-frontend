// src/components/auth/ForgotPasswordForm.jsx
import React, { useState } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { forgotPasswordApi } from '@/services/authService';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('ایمیل الزامی است.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = await forgotPasswordApi(email);
      console.debug('[FORGOT PASSWORD RESPONSE]', data);

      // برای dev: توکن را نگه داریم
      if (data?.token) {
        localStorage.setItem('reset_email', data.email || email);
        localStorage.setItem('reset_token', data.token);
      }

      toast.success(
        data?.message ||
          'اگر ایمیلی ثبت شده باشد، کد ریست برای شما تولید شده است.',
      );

      // می‌بریم کاربر را به صفحه‌ی وارد کردن توکن و رمز جدید
      navigate('/reset-password');
    } catch (err) {
      console.error('[FORGOT PASSWORD ERROR]', err);
      setError('خطا در ارسال درخواست ریست رمز. بعداً دوباره تلاش کنید.');
      toast.error('خطا در ارسال درخواست ریست رمز.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-md-center">
        <Col xs={12} md={6}>
          <h4>فراموشی رمز عبور</h4>
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formForgotEmail" className="mb-3">
              <Form.Label>ایمیل</Form.Label>
              <Form.Control
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'در حال ارسال…' : 'ارسال لینک/کد ریست'}
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}
