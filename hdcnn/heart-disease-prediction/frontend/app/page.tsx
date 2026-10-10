"use client";

import { motion } from "motion/react";
import { ShieldCheck, Stethoscope } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatModelPercent, useModelAnalysis } from "@/components/model-analysis-provider";

export default function Home() {
  const { metrics } = useModelAnalysis();

  return (
    <main className="login-page">
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
                <p className="login-brand__label">Heart Disease Prediction System</p>
                <p className="login-brand__subtitle">ML-based heart disease classification system</p>
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

            <div className="login-visual__meta">
              <span>Test Accuracy</span>
              <strong>{formatModelPercent(metrics.testAccuracy)}</strong>
            </div>
          </div>
        </aside>

        <main className="login-form-shell">
          <motion.div
            className="login-form"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          >
            <p className="eyebrow"><span className="eyebrow__line" /> secure clinical platform</p>
            <h1>Heart Disease Prediction System</h1>
            <p className="login-form__subtitle">ML-based heart disease classification system for research and clinical decision support.</p>

            <div className="login-form__fields" aria-label="Authentication options">
              <Link href="/login" className="login-button" aria-label="Login to the platform">
                Login
              </Link>
              <Link href="/register" className="secondary-button secondary-button--ghost" aria-label="Create a new account">
                Create Account
              </Link>
            </div>

            <div className="login-security-note">
              <ShieldCheck size={14} />
              <span>Authentic research pipeline with verified evaluation metrics and secure access controls.</span>
            </div>

            <div className="auth-summary-grid" aria-label="Model summary">
              <div>
                <span>Architecture</span>
                <strong>1D CNN</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>Multi-class</strong>
              </div>
              <div>
                <span>Test Accuracy</span>
                <strong>{formatModelPercent(metrics.testAccuracy)}</strong>
              </div>
            </div>

            <div className="login-signup">
              <span>Already a member?</span>
              <Link href="/login">Access the dashboard</Link>
            </div>
          </motion.div>
        </main>
      </motion.div>
    </main>
  );
}
