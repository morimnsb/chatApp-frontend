// src/hooks/useChatData.js
import { useEffect, useMemo } from 'react';
import useFetch from '../hooks/useFetch';
import { useDispatch } from 'react-redux';
import {
  setLoading,
  setUsers,
  setGroupMessages,
  setIndividualMessages,
  setError,
} from '../actions/messageActions';
import { toErrorMessage } from '../utils/errors';

export default function useChatData({ endpoints, accessToken }) {
  const dispatch = useDispatch();

  const fetchConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const { data: convos = { partners: [] }, loading: loadingConvos } = useFetch(
    endpoints.convos,
    fetchConfig,
  );

  const {
    data: rooms = [],
    loading: loadingRooms,
    error: errorRooms,
    retry: retryRooms,
  } = useFetch(endpoints.rooms, fetchConfig);

  const {
    data: users = [],
    loading: loadingUsers,
    error: errorUsers,
    retry: retryUsers,
  } = useFetch(endpoints.users, fetchConfig);

  useEffect(() => {
    if (convos?.partners) dispatch(setIndividualMessages(convos.partners));
    dispatch(setGroupMessages(Array.isArray(rooms) ? rooms : []));

    const list = Array.isArray(users)
      ? users
      : Array.isArray(users?.results)
      ? users.results
      : [];
    dispatch(setUsers(list));

    dispatch(setLoading(loadingConvos || loadingRooms || loadingUsers));

    const err = errorRooms || errorUsers;
    if (err) {
      dispatch(
        setError({
          type: 'messages',
          errorType: 'network',
          message: toErrorMessage(err),
        }),
      );
    } else {
      dispatch(setError(null));
    }
  }, [
    convos,
    rooms,
    users,
    loadingConvos,
    loadingRooms,
    loadingUsers,
    errorRooms,
    errorUsers,
    dispatch,
  ]);

  return {
    retryRooms,
    retryUsers,
  };
}
