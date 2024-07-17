import React, { useState } from 'react';
import { Form, Button, Container, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const RegisterForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password2: '',
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error when input changes
  };

  const { first_name, last_name, email, password, password2 } = formData;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!first_name || !last_name || !email || !password || !password2) {
      setError('All fields are required');
    } else if (password !== password2) {
      setError("Passwords don't match. Try again!");
    } else {
      try {
        const res = await axios.post(
          'http://localhost:8000/api/auth/register/',
          formData,
        );

        if (res.status === 201) {
          navigate('/verify-email');
          toast.success('Registration successful. Please verify your email.');
        }
      } catch (err) {
        if (err.response && err.response.data) {
          if (err.response.data.email) {
            setError(err.response.data.email[0]);
          } else if (err.response.data.password) {
            setError(err.response.data.password[0]);
          } else if (err.response.data.password2) {
            setError(err.response.data.password2[0]);
          }
        } else {
          setError('Server Error. Please try again later.');
        }
      }
    }
  };

  return (
    <Container className="registerForm-container">
      <Row className="justify-content-md-center">
        <Col xs={12} md={8}>
          <div className="registerForm-create-account">
            <h4>Create your account now:</h4>
            <p style={{ color: 'red' }}>{error}</p>
          </div>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="formFirstName">
              <Form.Label className="registerForm-required-label">
                First Name:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="text"
                placeholder="Enter your first name"
                name="first_name"
                value={first_name}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group controlId="formLastName">
              <Form.Label className="registerForm-required-label">
                Last Name:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="text"
                placeholder="Enter your last name"
                name="last_name"
                value={last_name}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group controlId="formEmail">
              <Form.Label className="registerForm-required-label">
                Email address:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="email"
                placeholder="Enter email"
                name="email"
                value={email}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group controlId="formPassword">
              <Form.Label className="registerForm-required-label">
                Password:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="password"
                placeholder="Password"
                name="password"
                value={password}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group controlId="formRepeatPassword">
              <Form.Label className="registerForm-required-label">
                Repeat Password:
              </Form.Label>
              <Form.Control
                className="registerForm-required-control"
                type="password"
                placeholder="Repeat Password"
                name="password2"
                value={password2}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Text className="text-muted">
              By signing up you agree to the{' '}
              <Link to="/terms" className="registerForm-terms-link">
                terms and conditions
              </Link>
              .
            </Form.Text>

            <Button
              className="registerForm-signup-button"
              variant="primary"
              type="submit"
            >
              Sign Up
            </Button>

            <div className="registerForm-haveAccount-container">
              <p className="registerForm-haveAccount">
                Already have an account?{' '}
                <Link to="/login" className="registerForm-login-link">
                  Login
                </Link>
              </p>
            </div>
          </Form>
          <h3>Or</h3>
          <div className="registerForm-GoogleContainer">
            <Button
              className="registerForm-signup-google-button"
              variant="primary"
              type="submit"
            >
              Sign Up with Google
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RegisterForm;
