import { createSlice } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";

const initialState = {
  isLoggedIn: false,
  loading: false,
  user: null,
  token: null,
  currentUserId: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(state, action) {
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      // Ensure the user ID is correctly extracted from the decoded token
      const decoded = jwtDecode(action.payload.token);
      state.currentUserId = decoded.user_id;
    },
    logout(state) {
      state.isLoggedIn = false;
      state.user = null;
      state.token = null;
      state.currentUserId = null;
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
  },
});

export const { login, logout, setLoading } = authSlice.actions;

export const selectToken = (state) => state.auth.token;

export const selectUserId = (state) => {
  if (state.auth.token) {
    const decoded = jwtDecode(state.auth.token);
    return decoded.user_id;
  }
  return null;
};

export const selectCurrentUserId = (state) => state.auth.currentUserId;

export default authSlice.reducer;
