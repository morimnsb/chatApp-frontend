import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isLoggedIn: false,
  loading: false,
  user: null, // { full_name: "..." }
  token: null, // Sanctum token string
  refresh_token: null, // random string we generated
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loading(state, action) {
      state.loading = action.payload;
    },
    login(state, action) {
      const { user, token, refresh_token } = action.payload;

      // IMPORTANT CHANGE:
      // no jwtDecode here, Sanctum is not JWT.

      state.isLoggedIn = true;
      state.loading = false;

      state.user = user || null;
      state.token = token || null;
      state.refresh_token = refresh_token || null;
    },
    logout(state) {
      state.isLoggedIn = false;
      state.loading = false;
      state.user = null;
      state.token = null;
      state.refresh_token = null;
    },
  },
});

export const { login } = authSlice.actions;
export default authSlice.reducer;
