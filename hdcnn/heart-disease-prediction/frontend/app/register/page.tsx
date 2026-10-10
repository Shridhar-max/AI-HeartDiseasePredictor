"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { AnatomicalHeart } from "@/components/AnatomicalHeart";
import { registerDemoAccount } from "@/lib/demo-auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError("Please provide your full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please provide a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter them.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await registerDemoAccount(name, email, password);
      router.replace("/login?registered=1");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the demo account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-visual">
          <div className="auth-visual__panel">
            <span className="auth-visual__tag">Demo onboarding</span>
            <AnatomicalHeart />
          </div>
        </div>

        <div className="auth-form-shell">
          <div className="auth-form">
            <p className="eyebrow"><span className="eyebrow__line" /> create account</p>
            <h1>Research access</h1>
            <p className="auth-form__subtitle">Create an account first. You will need this registered email and password to sign in on this browser.</p>

            <form className="auth-form__fields" onSubmit={handleSubmit} noValidate>
              <label className="field-block">
                <span>Full name</span>
                <div className="input-wrap">
                  <UserRound size={15} />
                  <input type="text" value={name} onChange={(event) => setName(event.target.value)} aria-label="Full name" required />
                </div>
              </label>

              <label className="field-block">
                <span>Email address</span>
                <div className="input-wrap">
                  <Mail size={15} />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email address" required />
                </div>
              </label>

              <label className="field-block">
                <span>Password</span>
                <div className="input-wrap">
                  <LockKeyhole size={15} />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Password" placeholder="At least 8 characters" required />
                </div>
              </label>

              <label className="field-block">
                <span>Confirm password</span>
                <div className="input-wrap">
                  <LockKeyhole size={15} />
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-label="Confirm password" placeholder="Repeat password" required />
                </div>
              </label>

              {error && <p className="form-inline-error" role="alert">{error}</p>}

              <button type="submit" className="primary-button full-width" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="auth-switch">
              Already registered?
              <Link href="/login" className="text-link">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
