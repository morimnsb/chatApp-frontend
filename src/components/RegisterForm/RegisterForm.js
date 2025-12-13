// src/components/RegisterForm.js
import React, { useState } from 'react';
import { Form, Button, Container, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const API_BASE =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.REACT_APP_API_BASE_LARAVEL) ||
  'http://localhost:8000/api';

const RegisterForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password2: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(''); // پاک کردن خطای کلی با هر تغییر
  };

  const { first_name, last_name, email, password, password2 } = formData;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ولیدیشن ساده فرانت
    if (!first_name || !last_name || !email || !password || !password2) {
      setError('همه فیلدها الزامی هستند.');
      return;
    }
    if (password !== password2) {
      setError('رمز عبور و تکرار آن یکسان نیستند.');
      return;
    }

    const payload = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim(),
      password: password, // سرور خودش هش می‌کند
      password_confirmation: password2, // لاراول نیاز دارد
    };

    const url = `${API_BASE.replace(/\/+$/, '')}/auth/register`; // بدون اسلش پایانی

    try {
      setSubmitting(true);
      setError('');

      // --- DEBUG: درخواست
      // eslint-disable-next-line no-console
      console.debug('[REGISTER REQUEST]', {
        url,
        payload,
        headers: { Accept: 'application/json' },
      });

      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        // timeout: 15000, // در صورت نیاز
      });

      // --- DEBUG: پاسخ
      // eslint-disable-next-line no-console
      console.debug('[REGISTER RESPONSE]', res.status, res.data);

      // بعضی APIها 200 می‌دهند، بعضی 201
      if (res.status === 200 || res.status === 201) {
        toast.success('ثبت‌نام موفق! لطفاً ایمیل خود را تأیید کنید.');
        console.log(res)
        navigate('/verify-email');
      } else {
        // حالت غیرمنتظره
        toast.info(`ثبت‌نام انجام شد (status: ${res.status}).`);
        navigate('/verify-email');
      }
    } catch (err) {
      // --- DEBUG: خطا
      // eslint-disable-next-line no-console
      console.error('[REGISTER ERROR RAW]', err);

      // تلاش برای استخراج پیام دقیق از ساختارهای رایج لاراول
      const resp = err?.response;
      const data = resp?.data;

      // eslint-disable-next-line no-console
      console.debug('[REGISTER ERROR PARSED]', {
        status: resp?.status,
        data,
      });

      let message = 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.';

      // ساختار رایج: { message: "...", errors: { field: [msg, ...], ... } }
      if (data?.errors && typeof data.errors === 'object') {
        const firstField = Object.keys(data.errors)[0];
        const firstMsg = data.errors[firstField]?.[0];
        if (firstMsg) message = firstMsg;
      } else if (typeof data?.message === 'string') {
        message = data.message;
      } else if (typeof data === 'string') {
        message = data;
      } else if (resp?.status === 422) {
        message = 'اعتبارسنجی ناموفق بود. لطفاً فیلدها را بررسی کنید.';
      }

      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="registerForm-container">
      <Row className="justify-content-md-center">
        <Col xs={12} md={8}>
          <div className="registerForm-create-account">
            <h4>اکانت خودتان را ایجاد کنید:</h4>
            {error ? <p style={{ color: 'red' }}>{error}</p> : null}
          </div>

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="formFirstName" className="mb-3">
              <Form.Label className="registerForm-required-label">
                نام:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="text"
                placeholder="نام"
                name="first_name"
                value={first_name}
                onChange={handleChange}
                required
                autoComplete="given-name"
              />
            </Form.Group>

            <Form.Group controlId="formLastName" className="mb-3">
              <Form.Label className="registerForm-required-label">
                نام خانوادگی:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="text"
                placeholder="نام خانوادگی"
                name="last_name"
                value={last_name}
                onChange={handleChange}
                required
                autoComplete="family-name"
              />
            </Form.Group>

            <Form.Group controlId="formEmail" className="mb-3">
              <Form.Label className="registerForm-required-label">
                ایمیل:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="email"
                placeholder="example@mail.com"
                name="email"
                value={email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Form.Group controlId="formPassword" className="mb-3">
              <Form.Label className="registerForm-required-label">
                رمز عبور:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="password"
                placeholder="******"
                name="password"
                value={password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Form.Group controlId="formRepeatPassword" className="mb-3">
              <Form.Label className="registerForm-required-label">
                تکرار رمز عبور:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="password"
                placeholder="******"
                name="password2"
                value={password2}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </Form.Group>

            <Form.Text className="text-muted d-block mb-3">
              با ثبت‌نام، شما با{' '}
              <Link to="/terms" className="registerForm-terms-link">
                قوانین و شرایط
              </Link>{' '}
              موافقید.
            </Form.Text>

            <Button
              className="registerForm-signup-button"
              variant="primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'در حال ارسال…' : 'ثبت‌نام'}
            </Button>

            <div className="registerForm-haveAccount-container">
              <p className="registerForm-haveAccount">
                حساب دارید؟{' '}
                <Link to="/login" className="registerForm-login-link">
                  ورود
                </Link>
              </p>
            </div>
          </Form>

          <h3>یا</h3>
          <div className="registerForm-GoogleContainer">
            <Button
              className="registerForm-signup-google-button"
              variant="primary"
              type="button"
              onClick={() => toast.info('Google OAuth بعداً اضافه می‌شود')}
              disabled={submitting}
            >
              ثبت‌نام با Google
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RegisterForm;
