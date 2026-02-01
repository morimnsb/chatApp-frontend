// src/components/auth/LogoutButton.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from 'react-bootstrap';
import { logoutThunk, localLogout } from '@/app/store/authSlice';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await dispatch(logoutThunk()).unwrap();
    } catch (err) {
      console.error('[LOGOUT ERROR]', err);
    } finally {
      dispatch(localLogout()); // همیشه
      setLoading(false);
      navigate('/login', { replace: true });
    }
  };


  return (
    <Button
      variant="outline-danger"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <>
          <Spinner animation="border" size="sm" className="me-1" />
          Logging out…
        </>
      ) : (
        'Logout'
      )}
    </Button>
  );
}

