import React, { useState } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import './VerifyEmail.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const VerifyEmail = () => {
  const [otp, setOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Make Axios request to verify OTP
      const response = await axios.post(
        'http://localhost:8000/api/auth/verify-email/',
        { otp },
      );
      console.log(response.data); // Assuming the response contains success message
      if (response.status === 200) {
        // Redirect to login page
        navigate('/login');
        toast.success(response.data.message);
      }
    } catch (error) {
      setVerificationError(error.response.data.message); // Assuming error response contains a message
    }
  };

  return (
    <Container className="verify-email-container">
      <h3 className="VerifyEmail-Otp">Verify OTP</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="formOTP">
          <Form.Label className="VerifyEmail-required-label">
            Enter OTP
          </Form.Label>
          <Form.Control
            className="VerifyEmail-required-control"
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
        </Form.Group>

        {verificationError && (
          <p className="text-danger">{verificationError}</p>
        )}

        <Button className="Verifyemail-button" variant="primary" type="submit">
          Verify
        </Button>
      </Form>
    </Container>
  );
};

export default VerifyEmail;
