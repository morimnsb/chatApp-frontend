// src/components/auth/ChangePasswordForm.jsx
import React, { useState } from 'react';
import { Form, Button, Container, Row, Col } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { changePasswordApi } from '@/services/authService';

export default function ChangePasswordForm() {
  const [formData, setFormData] = useState({
    current_password: '',
    password: '',
    password2: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { current_password, password, password2 } = formData;

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!current_password || !password || !password2) {
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

      console.debug('[CHANGE PASSWORD REQUEST]', {
        hasCurrent: !!current_password,
      });

      const res = await changePasswordApi({
        current_password,
        password,
        password2,
      });

      console.debug('[CHANGE PASSWORD RESPONSE]', res);

      toast.success(res?.message || 'رمز عبور با موفقیت تغییر کرد.');
      // پس از موفقیت، فرم را خالی می‌کنیم
      setFormData({
        current_password: '',
        password: '',
        password2: '',
      });
    } catch (err) {
      console.error('[CHANGE PASSWORD ERROR RAW]', err);
      const resp = err?.response;
      const data = resp?.data;

      console.debug('[CHANGE PASSWORD ERROR PARSED]', {
        status: resp?.status,
        data,
      });

      let message = 'خطا در تغییر رمز عبور. لطفاً بعداً دوباره تلاش کنید.';

      if (data?.errors && typeof data.errors === 'object') {
        const firstField = Object.keys(data.errors)[0];
        const firstMsg = data.errors[firstField]?.[0];
        if (firstMsg) message = firstMsg;
      } else if (typeof data?.message === 'string') {
        message = data.message;
      } else if (resp?.status === 422) {
        message = 'اعتبارسنجی ناموفق بود. لطفاً فیلدها را بررسی کنید.';
      } else if (err.message === 'NO_XSRF_TOKEN') {
        message = 'مشکل در CSRF. لطفاً صفحه را رفرش کرده و دوباره امتحان کنید.';
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
          <h4>تغییر رمز عبور</h4>
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formCurrentPassword" className="mb-3">
              <Form.Label>رمز عبور فعلی</Form.Label>
              <Form.Control
                type="password"
                name="current_password"
                value={current_password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </Form.Group>

            <Form.Group controlId="formNewPassword" className="mb-3">
              <Form.Label>رمز عبور جدید</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Form.Group controlId="formNewPassword2" className="mb-3">
              <Form.Label>تکرار رمز عبور جدید</Form.Label>
              <Form.Control
                type="password"
                name="password2"
                value={password2}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'در حال ارسال…' : 'ذخیره رمز عبور جدید'}
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}
