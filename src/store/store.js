import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../../src/store/authStore.js";

export default configureStore({
  reducer: {
    auth: authReducer,
  },
});
