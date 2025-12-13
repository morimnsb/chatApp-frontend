// src/components/VerifyEmail.js
import React, { useState, useEffect } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import './VerifyEmail.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const VerifyEmail = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // ایمیل ثبت‌نام‌شده را از لوکال‌استوریج می‌گیریم
    const e = localStorage.getItem('pending_email');
    const o = localStorage.getItem('pending_otp'); // فقط برای توسعه
    if (e) setEmail(e);
    if (o && !otp) setOtp(o); // برای راحتی dev
  }, []); // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault();
    setVerificationError('');

    // دیباگِ ورودی
    console.log('[VERIFY SUBMIT] payload:', { email, otp });

    try {
      const url = 'http://localhost:8000/api/auth/verify-email'; // بدون اسلش آخر
      const payload = { email, otp };

      console.log('[VERIFY REQUEST] POST', url, payload);
      const response = await axios.post(url, payload);
      console.log('[VERIFY OK]', response.status, response.data);

      toast.success(response.data?.message || 'ایمیل تأیید شد');
      // پاک کردن مقادیر موقت
      localStorage.removeItem('pending_email');
      localStorage.removeItem('pending_otp');
      navigate('/login');
    } catch (error) {
      // لاگ کامل دیباگ
      console.error('[VERIFY ERROR RAW]', error);
      const status = error.response?.status;
      const data = error.response?.data;

      // پیام قابل‌نمایش
      const msg =
        data?.error ||
        data?.message ||
        (status === 422
          ? 'فیلدهای ارسالی نامعتبر است. ایمیل و کد OTP را بررسی کنید.'
          : 'خطا در تأیید ایمیل');

      setVerificationError(msg);
      toast.error(msg);

      // دیباگ بیشتر
      console.log('[VERIFY DEBUG]', {
        status,
        data,
        sent: { email, otpLength: (otp || '').length },
      });
    }
  };

  return (
    <Container className="verify-email-container">
      <h3 className="VerifyEmail-Otp">Verify OTP</h3>

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="formEmail">
          <Form.Label className="VerifyEmail-required-label">Email</Form.Label>
          <Form.Control
            className="VerifyEmail-required-control"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group controlId="formOTP">
          <Form.Label className="VerifyEmail-required-label">
            Enter OTP
          </Form.Label>
          <Form.Control
            className="VerifyEmail-required-control"
            type="text"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            inputMode="numeric"
            maxLength={6}
          />
        </Form.Group>

        {verificationError && (
          <p className="text-danger mt-2">{verificationError}</p>
        )}

        <Button
          className="Verifyemail-button mt-3"
          variant="primary"
          type="submit"
        >
          Verify
        </Button>
      </Form>
    </Container>
  );
};

export default VerifyEmail;
