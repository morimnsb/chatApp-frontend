// src/hooks/useUsers.js
import { useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useFetch from '../hooks/useFetch';
import { setUsers, setLoading, setError } from '../actions/messageActions';
import { toErrorMessage } from '../utils/errors';

/**
 * Fetch users and wire to Redux.
 * Also returns filteredUsers (بدون کاربر فعلی).
 */
export default function useUsers({ endpoints, accessToken, currentUser }) {
  const dispatch = useDispatch();

  const fetchConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const {
    data: usersResp = [],
    loading: loadingUsers,
    error: errorUsers,
    retry: retryUsers,
  } = useFetch(endpoints.users, fetchConfig);

  useEffect(() => {
    // users API ممکنه صفحه‌بندی داشته باشه (results)
    const list = Array.isArray(usersResp)
      ? usersResp
      : Array.isArray(usersResp?.results)
      ? usersResp.results
      : [];

    dispatch(setUsers(list));
    dispatch(setLoading(Boolean(loadingUsers)));


    if (errorUsers) {
      dispatch(
        setError({
          type: 'users',
          errorType: 'network',
          message: toErrorMessage(errorUsers),
        }),
      );
    }
  }, [usersResp, loadingUsers, errorUsers, dispatch]);

  const filteredUsers = useMemo(() => {
    const list = Array.isArray(usersResp)
      ? usersResp
      : Array.isArray(usersResp?.results)
      ? usersResp.results
      : [];
    return list.filter((u) => u?.id !== currentUser);
  }, [usersResp, currentUser]);

  return {
    loadingUsers,
    errorUsers,
    retryUsers,
    filteredUsers,
  };
}
