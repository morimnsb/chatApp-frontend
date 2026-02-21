// chatApp-frontend\src\features\chat\components\Gate.tsx
import React, { type ReactNode } from "react";
import { Spinner, Alert } from "react-bootstrap";

type Props = {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
};

export default function Gate({
  loading = false,
  error = null,
  onRetry,
  children,
}: Props) {
  if (loading) {
    return <Spinner animation="border" variant="primary" />;
  }

  if (error) {
    return (
      <Alert variant="danger">
        Error loading data. {String(error)}
        {onRetry && (
          <button className="btn btn-link" onClick={onRetry}>
            Retry
          </button>
        )}
      </Alert>
    );
  }

  return <>{children}</>;
}