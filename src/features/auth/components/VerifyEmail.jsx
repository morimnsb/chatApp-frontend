// src/components/VerifyEmail/VerifyEmail.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { verifyEmailApi } from '@/shared/services/authService';
import { hydrateAuth } from '@/app/store/authSlice'; // همونی که داری

export default function VerifyEmail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const e = sessionStorage.getItem('pending_email');
    const o = sessionStorage.getItem('pending_otp'); // فقط برای dev
    if (e) setEmail(e);
    if (o) setOtp(o);
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await verifyEmailApi({ email, otp });
      // res: { access_token, user, token_type, message }

      const access_token = res.access_token;

      // 1) ذخیره توکن
      localStorage.setItem('access_token', access_token);

      // 2) ست کردن Redux auth state
      dispatch(
        hydrateAuth({
          user: res.user,
          token: access_token,
          refresh_token: res.refresh_token ?? null,
          expires_at: res.expires_at ?? null,
        }),
      );

      // 3) پاک کردن pending email
      sessionStorage.removeItem('pending_email');
      sessionStorage.removeItem('pending_otp');

      // 4) رفتن به صفحه اصلی (لاگین خودکار)
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'VERIFY_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-wrap">
      <h3>Verify Email</h3>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleVerify}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <input
          type="text"
          placeholder="OTP (6 digits)"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          required
        />

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
}


