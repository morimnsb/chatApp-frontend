import React from 'react';
import { Spinner, Alert } from 'react-bootstrap';

export default function Gate({ loading, error, onRetry, children }) {
  if (loading) return <Spinner animation="border" variant="primary" />;

  if (error)
    return (
      <Alert variant="danger">
        Error loading data. {String(error)}
        <button className="btn btn-link" onClick={onRetry}>
          Retry
        </button>
      </Alert>
    );

  return children;
}
