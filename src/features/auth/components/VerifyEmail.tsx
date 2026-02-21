// chatApp-frontend\src\features\auth\components\VerifyEmail.tsx
// chatApp-frontend/src/features/auth/components/VerifyEmail.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Container, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import { verifyEmailApi } from "@/shared/services/authService";

import { useNavigate } from "react-router-dom";
import { hydrateAuth, meThunk } from "@/app/store/authSlice";
import { hardResetSocket } from "@/shared/ws/socketClient";
import { useAppDispatch } from "@/app/store/hooks";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[VerifyEmail]", ...a);

const normEmail = (s: unknown) => String(s || "").trim().toLowerCase();
const normOtp = (s: unknown) => String(s || "").trim();

function getErrMessage(err: unknown): string {
  const e = err as any;
  return (
    e?.response?.data?.message ||
    e?.response?.data?.meta?.code ||
    e?.response?.data?.detail ||
    e?.message ||
    "خطا در تایید ایمیل"
  );
}

export default function VerifyEmail() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("000000");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const emailNorm = useMemo(() => normEmail(email), [email]);
  const otpNorm = useMemo(() => normOtp(otp), [otp]);

  useEffect(() => {
    try {
      const pe = sessionStorage.getItem("pending_email") || "";
      const po = sessionStorage.getItem("pending_otp") || "000000";

      log("mount storage snapshot", {
        pending_email_raw: pe,
        pending_email_norm: normEmail(pe),
        pending_otp_raw: po,
        pending_otp_norm: normOtp(po),
      });

      setEmail(normEmail(pe));
      setOtp(normOtp(po) || "000000");
    } catch (e: any) {
      log("read storage failed", e?.message);
    }
  }, []);

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let storageNow: { pending_email: string | null; pending_otp: string | null } = {
      pending_email: null,
      pending_otp: null,
    };

    try {
      storageNow = {
        pending_email: sessionStorage.getItem("pending_email"),
        pending_otp: sessionStorage.getItem("pending_otp"),
      };
    } catch {
      // ignore
    }

    const pendingEmailNorm = normEmail(storageNow.pending_email);
    const pendingOtpNorm = normOtp(storageNow.pending_otp);

    const finalEmail = pendingEmailNorm || emailNorm;
    const finalOtp = pendingOtpNorm || otpNorm || "000000";

    log("submit snapshot", {
      state: { email_raw: email, email_norm: emailNorm, otp_raw: otp, otp_norm: otpNorm },
      storage: { pending_email_raw: storageNow.pending_email, pending_otp_raw: storageNow.pending_otp },
      finalPayload: { email: finalEmail, otp: finalOtp },
    });

    if (!finalEmail) return void toast.error("ایمیل پیدا نشد. لطفاً دوباره ثبت‌نام کنید.");
    if (!finalOtp) return void toast.error("کد OTP خالی است.");

    try {
      setSubmitting(true);

      const res: unknown = await verifyEmailApi({ email: finalEmail, otp: String(finalOtp) });
      log("verify success", res);

      // ✅ 1) hydrate با خود response
      dispatch(hydrateAuth(res as any));

      // ✅ 2) چون قبل لاگین WS نمی‌خوایم، فقط reset کنیم (connect نکن)
      try {
        hardResetSocket("verified");
      } catch {
        // ignore
      }

      // ✅ 3) sync user از /me (برای ProtectedRoute / UI)
      try {
        await dispatch(meThunk()).unwrap();
      } catch (e: unknown) {
        log("meThunk after verify failed", (e as any)?.message || e);
      }

      toast.success("ایمیل با موفقیت تایید شد ✅");

      try {
        sessionStorage.removeItem("pending_email");
        sessionStorage.removeItem("pending_otp");
      } catch {
        // ignore
      }

      navigate("/");
    } catch (err: unknown) {
      const e = err as any;

      log("verify failed", {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
      });

      toast.error(String(getErrMessage(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container style={{ maxWidth: 420, paddingTop: 40 }}>
      <h4>تایید ایمیل</h4>

      {DEBUG && (
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
          debug: emailNorm=<code>{emailNorm || "(empty)"}</code>{" "}
          otpNorm=<code>{otpNorm || "(empty)"}</code>
        </div>
      )}

      <Form onSubmit={handleVerify}>
        <Form.Group className="mb-3">
          <Form.Label>ایمیل</Form.Label>
          <Form.Control
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>کد OTP</Form.Label>
          <Form.Control
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            inputMode="numeric"
          />
        </Form.Group>

        <Button type="submit" disabled={submitting}>
          {submitting ? "در حال تایید..." : "تایید"}
        </Button>
      </Form>
    </Container>
  );
}