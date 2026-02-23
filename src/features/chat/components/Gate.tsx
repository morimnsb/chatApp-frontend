import React from "react";
import { Spinner, Alert } from "react-bootstrap";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

type ApiErrorLike = {
  status?: number;
  data?: { message?: string };
  error?: string;
  message?: string;
  detail?: string;
  [k: string]: any;
};

type GateError = FetchBaseQueryError | SerializedError | ApiErrorLike | null | undefined;

type GateProps = {
  loading?: boolean;
  error?: GateError;
  onRetry?: () => void;
  children: React.ReactNode;
};

const errText = (e: GateError) => {
  if (!e) return "";
  const anyE: any = e;

  // RTK Query: { status, data } or { error }
  if (typeof anyE?.data === "string") return anyE.data;
  const msg =
    anyE?.data?.message ??
    anyE?.message ??
    anyE?.detail ??
    anyE?.error ??
    (typeof anyE === "string" ? anyE : "");

  const st = typeof anyE?.status === "number" ? ` (${anyE.status})` : "";
  return `${msg || "Unknown error"}${st}`;
};

export default function Gate({ loading = false, error, onRetry, children }: GateProps) {
  if (loading) return <Spinner animation="border" variant="primary" />;

  if (error)
    return (
      <Alert variant="danger">
        Error loading data. {errText(error)}
        {onRetry && (
          <button className="btn btn-link" onClick={onRetry}>
            Retry
          </button>
        )}
      </Alert>
    );

  return <>{children}</>;
}