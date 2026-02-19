// src/features/auth/components/VerifyEmail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Container, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import { verifyEmailApi } from "@/shared/services/authService";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { hydrateAuth, meThunk } from "@/app/store/authSlice";
import { hardResetSocket } from "@/shared/ws/socketClient";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a) => DEBUG && console.log("[VerifyEmail]", ...a);

const normEmail = (s) => String(s || "").trim().toLowerCase();
const normOtp = (s) => String(s || "").trim();

export default function VerifyEmail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("000000");
  const [submitting, setSubmitting] = useState(false);

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
    } catch (e) {
      log("read storage failed", e?.message);
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();

    let storageNow = { pending_email: null, pending_otp: null };
    try {
      storageNow = {
        pending_email: sessionStorage.getItem("pending_email"),
        pending_otp: sessionStorage.getItem("pending_otp"),
      };
    } catch {}

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

      const res = await verifyEmailApi({ email: finalEmail, otp: String(finalOtp) });
      log("verify success", res);

      // ✅ 1) hydrate با خود response
      dispatch(hydrateAuth(res));

      // ✅ 2) چون ما قبل لاگین WS نمی‌خوایم، فقط reset کنیم (connect نکن)
      try {
        hardResetSocket("verified");
      } catch {}

      // ✅ 3) sync user از /me (برای ProtectedRoute / UI)
      try {
        await dispatch(meThunk()).unwrap();
      } catch (e) {
        log("meThunk after verify failed", e?.message);
      }

      toast.success("ایمیل با موفقیت تایید شد ✅");

      try {
        sessionStorage.removeItem("pending_email");
        sessionStorage.removeItem("pending_otp");
      } catch {}

      navigate("/");
    } catch (err) {
      log("verify failed", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.meta?.code ||
        "خطا در تایید ایمیل";

      toast.error(String(msg));
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
          <Form.Control value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
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
