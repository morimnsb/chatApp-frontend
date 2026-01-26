// chatApp-frontend\src\reducers\messageReducer.js
import { produce } from 'immer';
import messageActionTypes from '../actions/messageActionTypes';
import { initialState } from './messages/initialState';
import { h } from './messages/handlers';

const ok = (a) => a && typeof a === 'object' && a.type != null;

export default produce((d, a) => {
  if (!ok(a)) return;

  const p = a.payload;

  switch (a.type) {
    case messageActionTypes.SET_CURRENT_USER:
      h.setCurrentUser(d, p);
      break;

    case messageActionTypes.SET_USERS:
      h.setUsers(d, p);
      break;

    case messageActionTypes.SET_INDIVIDUAL_MESSAGES:
      h.setIndividualMessages(d, p);
      break;

    case messageActionTypes.SET_GROUP_MESSAGES:
      h.setGroupMessages(d, p);
      break;

    case messageActionTypes.SELECT_ROOM:
      h.selectRoom(d, p);
      break;

    case messageActionTypes.UPDATE_MESSAGES:
      h.updateMessages(d, p);
      break;

    case messageActionTypes.UPDATE_STATUS:
      h.updateStatus(d, p);
      break;

    case messageActionTypes.CLEAR_UNREAD_COUNT:
      h.clearUnreadCount(d, p);
      break;

    case messageActionTypes.SET_LOADING:
      h.setLoading(d, p);
      break;

    case messageActionTypes.SET_ERROR:
      h.setError(d, p);
      break;

    case messageActionTypes.SET_TYPING_INDICATOR:
      h.setTyping(d, p);
      break;

    case messageActionTypes.RESET_TYPING_INDICATOR:
      h.resetTyping(d, p);
      break;

    case messageActionTypes.DELETE_MESSAGE:
      h.deleteMessage(d, p);
      break;

    default:
      break;
  }
}, initialState);
