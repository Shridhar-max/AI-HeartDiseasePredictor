"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { FormEvent, useState } from "react";
import { authenticateDemoAccount, startDemoSession } from "@/lib/demo-auth";

type FormValues = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [formValues, setFormValues] = useState<FormValues>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validateForm(values: FormValues): FormErrors {
    const nextErrors: FormErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!emailPattern.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!values.password.trim()) {
      nextErrors.password = "Password is required.";
    }

    return nextErrors;
  }

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextErrors = validateForm(formValues);
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const account = await authenticateDemoAccount(formValues.email, formValues.password);
      if (!account) {
        setSubmitError("No matching registered account was found. Register first or check your email and password.");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
      window.localStorage.setItem(
        "cardio-profile",
        JSON.stringify({
          fullName: account.fullName,
          email: account.email,
          phone: "Not provided",
          role: "Research User",
          institution: "Heart Disease Prediction Lab",
        }),
      );
      startDemoSession(account.email);

      let notificationError = "";
      try {
        window.sessionStorage.removeItem("cardio-telegram-notification-error");
        window.sessionStorage.removeItem("cardio-telegram-notification-sent");
      } catch {
        console.error("A previous Telegram sign-in notification status could not be cleared.");
      }

      try {
        const response = await fetch("/api/demo-sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "demo-sign-in",
            fullName: account.fullName,
            email: account.email,
          }),
          cache: "no-store",
        });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          notificationError =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Telegram did not accept the sign-in notice.";
        } else if (
          typeof result === "object" &&
          result !== null &&
          "messageId" in result &&
          typeof result.messageId === "number" &&
          Number.isSafeInteger(result.messageId)
        ) {
          try {
            window.sessionStorage.setItem(
              "cardio-telegram-notification-sent",
              String(result.messageId),
            );
          } catch {
            console.error("Telegram accepted the sign-in notice, but its delivery receipt could not be saved.");
          }
        } else {
          notificationError = "Telegram responded without a delivery receipt. Check the bot chat before retrying.";
        }
      } catch {
        notificationError = "Telegram could not be reached. The sign-in notice was not delivered.";
      }

      if (notificationError) {
        try {
          window.sessionStorage.setItem("cardio-telegram-notification-error", notificationError);
        } catch {
          console.error("Telegram sign-in notification failed and its status could not be saved.");
        }
      }

      router.push("/dashboard");
    } catch {
      setSubmitError("Unable to complete demo sign-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <motion.div
        className="login-layout"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <aside className="login-visual" aria-label="Medical brand panel">
          <div className="login-visual__panel">
            <div className="login-visual__brand">
              <span className="login-visual__mark">
                <Stethoscope size={18} />
              </span>
              <div>
                <p className="login-brand__label">Heart Disease Prediction</p>
                <p className="login-brand__subtitle">Machine learning-based heart disease prediction</p>
              </div>
            </div>

            <div className="login-visual__badge">1D CNN • 7-CLASS MODEL</div>

            <motion.div
              className="login-visual__image-wrap"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
            >
              <Image
                src="/images/anatomical-heart.png"
                alt="Anatomical illustration of the human heart used in cardiovascular risk analysis"
                className="login-visual__image"
                width={480}
                height={430}
                priority
              />
            </motion.div>
          </div>
        </aside>

        <main className="login-form-shell">
          <motion.div
            className="login-form"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          >
            <p className="eyebrow"><span className="eyebrow__line" /> secure research access</p>
            <h1>Welcome Back</h1>
            <p className="login-form__subtitle">Sign in to access your prediction workspace.</p>

            <form className="login-form__fields" onSubmit={handleSubmit} noValidate>
              <label className="login-field-block" htmlFor="login-email">
                <span>Email Address</span>
                <div className={`login-input ${errors.email ? "is-invalid" : ""}`}>
                  <Mail size={16} />
                  <input
                    id="login-email"
                    type="email"
                    value={formValues.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "login-email-error" : undefined}
                    autoComplete="email"
                    placeholder="name@institution.org"
                  />
                </div>
                {errors.email ? (
                  <small id="login-email-error" className="login-field-error" role="alert">
                    {errors.email}
                  </small>
                ) : null}
              </label>

              <label className="login-field-block" htmlFor="login-password">
                <span>Password</span>
                <div className={`login-input ${errors.password ? "is-invalid" : ""}`}>
                  <LockKeyhole size={16} />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={formValues.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "login-password-error" : undefined}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password ? (
                  <small id="login-password-error" className="login-field-error" role="alert">
                    {errors.password}
                  </small>
                ) : null}
              </label>

              {submitError ? (
                <p className="login-form__error" role="alert">{submitError}</p>
              ) : null}

              <button
                type="submit"
                className="login-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle size={16} className="login-button__spinner" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="login-signup">
              <span>Don&apos;t have an account?</span>
              <Link href="/register">Create an account</Link>
            </p>

            <div className="login-security-note">
              <ShieldCheck size={14} />
              <span>Demo accounts are stored only in this browser and are not verified against Gmail. You must register before signing in. Passwords are stored as salted hashes; each successful sign-in sends your registered name and email with the access time in Indian Standard Time (IST) to the project Telegram bot. Do not reuse a real password.</span>
            </div>
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
