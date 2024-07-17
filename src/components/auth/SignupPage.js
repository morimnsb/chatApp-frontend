import React from "react";
import { useSelector, useDispatch } from "react-redux";
import RegisterForm from "../RegisterForm/RegisterForm"; // Ensure correct path

const SignupPage = () => {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn); // Example selector, adjust as needed

  return (
    <div>
      <h2>Signup Page</h2>
      <RegisterForm />
      {/* Additional content here */}
    </div>
  );
};

export default SignupPage;
