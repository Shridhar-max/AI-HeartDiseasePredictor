"use client";

import { motion } from "motion/react";

export function ECGLine() {
  return (
    <div className="ecg-decoration" aria-label="Decorative ECG-style waveform">
      <span>DECORATIVE SIGNAL / NOT LIVE MONITORING</span>
      <svg viewBox="0 0 520 64" role="img" aria-hidden="true" preserveAspectRatio="none">
        <motion.path
          d="M0 34 H70 L82 34 L91 15 L101 50 L111 29 L120 34 H205 L216 34 L225 23 L235 44 L245 34 H312 L322 34 L334 8 L345 55 L355 34 H430 L440 34 L449 22 L458 44 L468 34 H520"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}
