// src/app/AuthBootstrap.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { meThunk, markBootstrapped, selectBootstrapped } from '@/app/store/authSlice';

export default function AuthBootstrap() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  // 👇 مستقیم از state بخون
  const token = useSelector((state) => state.auth.token);

  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    if (!token) {
      dispatch(markBootstrapped());
      return;
    }

    dispatch(meThunk());
  }, [dispatch, token]);

  return null;
}
