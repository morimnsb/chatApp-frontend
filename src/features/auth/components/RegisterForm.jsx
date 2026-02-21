import React, { useState, useMemo } from 'react';
import { Form, Button, Container, Row, Col } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { registerApi } from '@/shared/services/authService';

const normalize = (s) => String(s || '').trim();
const normalizeSpace = (s) => normalize(s).replace(/\s+/g, ' ');

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

  const { first_name, last_name, email, password, password2 } = formData;

  // ✅ Standard full name for ALL backends
  const fullName = useMemo(() => {
    return normalizeSpace(`${first_name} ${last_name}`);
  }, [first_name, last_name]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ UI validation (local)
    if (!first_name || !last_name || !email || !password || !password2) {
      setError('همه فیلدها الزامی هستند.');
      return;
    }
    if (password !== password2) {
      setError('رمز عبور و تکرار آن یکسان نیستند.');
      return;
    }
    if (normalize(email) === '') {
      setError('ایمیل معتبر نیست.');
      return;
    }
    if (fullName.length < 2) {
      setError('نام و نام خانوادگی معتبر نیست.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // ✅ STANDARD payload for all backends
      const payload = {
        name: fullName,
        email: normalize(email),
        password,
      };

      console.debug('[REGISTER REQUEST PAYLOAD][STANDARD]', payload);

      const data = await registerApi(payload);

      console.debug('[REGISTER RESPONSE DATA]', data);

      // ✅ Keep verify-email flow
      sessionStorage.setItem('pending_email', normalize(email));
      if (data?.otp) sessionStorage.setItem('pending_otp', String(data.otp));

      toast.success('ثبت‌نام موفق! لطفاً ایمیل خود را با کد OTP تأیید کنید.');
      navigate('/verify-email');
    } catch (err) {
      console.error('[REGISTER ERROR RAW]', err);
      const resp = err?.response;
      const data = resp?.data;

      console.debug('[REGISTER ERROR PARSED]', {
        status: resp?.status,
        data,
      });

      let message = 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.';

      if (data?.errors && typeof data.errors === 'object') {
        const firstField = Object.keys(data.errors)[0];
        const firstMsg = data.errors[firstField]?.[0];
        if (firstMsg) message = firstMsg;
      } else if (typeof data?.message === 'string') {
        message = data.message;
      } else if (typeof data === 'string') {
        message = data;
      } else if (resp?.status === 409) {
        message = 'این ایمیل قبلاً ثبت شده است.';
      } else if (resp?.status === 422) {
        message = 'اعتبارسنجی ناموفق بود. لطفاً فیلدها را بررسی کنید.';
      } else if (err?.message === 'NO_XSRF_TOKEN') {
        message = 'مشکل در CSRF. لطفاً صفحه را رفرش کرده و دوباره امتحان کنید.';
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
              <Form.Label className="registerForm-required-label">نام:</Form.Label>
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
              <Form.Label className="registerForm-required-label">نام خانوادگی:</Form.Label>
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
              <Form.Label className="registerForm-required-label">ایمیل:</Form.Label>
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
              <Form.Label className="registerForm-required-label">رمز عبور:</Form.Label>
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
              <Form.Label className="registerForm-required-label">تکرار رمز عبور:</Form.Label>
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