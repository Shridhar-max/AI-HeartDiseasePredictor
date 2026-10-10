"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, CircleAlert, Clock3, FileSpreadsheet, Gauge, Pause, Play, RefreshCw, Stethoscope } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { formatModelPercent, useModelAnalysis } from "@/components/model-analysis-provider";
import { fetchHealth, fetchHistory, PredictionApiError, type HistoryRecord } from "@/lib/api";
import { modelMetrics } from "@/lib/model-metrics";

const heartSlides = [
  {
    title: "A closer look at the heart",
    detail: "Explore cardiovascular health through a clinical lens.",
    image: "/images/anatomical-heart.png",
    alt: "Detailed anatomical illustration of the human heart",
    theme: "anatomy",
    label: "ANATOMY / 01",
  },
  {
    title: "Every beat tells a story",
    detail: "A visual reminder of the signals behind heart health.",
    image: "/images/heart-pulse.svg",
    alt: "Illustrated heart with a glowing electrocardiogram line",
    theme: "pulse",
    label: "CARDIAC SIGNAL / 02",
  },
  {
    title: "Care starts with insight",
    detail: "Turn clinical data into a clearer starting point for review.",
    image: "/images/heart-care.svg",
    alt: "Illustrated heart protected by a medical shield",
    theme: "care",
    label: "HEART HEALTH / 03",
  },
] as const;

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatConfidence(value: number) {
  return `${Math.min(Math.max(value, 0), 100).toFixed(2)}%`;
}

function HeartCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const [activeSlide, setActiveSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const slide = heartSlides[activeSlide];

  useEffect(() => {
    if (isPaused || isInteracting || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveSlide((current) => (current + 1) % heartSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, prefersReducedMotion]);

  function goToSlide(index: number) {
    setDirection(index > activeSlide ? 1 : -1);
    setActiveSlide(index);
  }

  function moveSlide(offset: number) {
    const nextIndex = (activeSlide + offset + heartSlides.length) % heartSlides.length;
    goToSlide(nextIndex);
  }

  return (
    <section
      className="dashboard-carousel"
      aria-label="Heart health highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsInteracting(false);
      }}
    >
      <div className="dashboard-carousel__topline">
        <span><span className="dashboard-carousel__live-dot" /> HEART HEALTH / RESEARCH</span>
        <span>{String(activeSlide + 1).padStart(2, "0")} <i>/</i> {String(heartSlides.length).padStart(2, "0")}</span>
      </div>

      <div className="dashboard-carousel__stage" data-theme={slide.theme}>
        <span className="dashboard-carousel__orbit dashboard-carousel__orbit--one" aria-hidden="true" />
        <span className="dashboard-carousel__orbit dashboard-carousel__orbit--two" aria-hidden="true" />
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={slide.image}
            className="dashboard-carousel__art"
            custom={direction}
            initial={prefersReducedMotion ? false : { opacity: 0, x: direction * 26, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, x: direction * -20, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: "easeOut" }}
          >
            <Image
              className="dashboard-carousel__image"
              src={slide.image}
              alt={slide.alt}
              width={960}
              height={720}
              priority={activeSlide === 0}
            />
          </motion.div>
        </AnimatePresence>
        <span className="dashboard-carousel__image-label">{slide.label}</span>
        <span className="dashboard-carousel__image-mark" aria-hidden="true"><Activity size={15} /> CLINICAL INSIGHT</span>
      </div>

      <div className="dashboard-carousel__footer">
        <div className="dashboard-carousel__copy" aria-live="polite">
          <span>0{activeSlide + 1} / FEATURE</span>
          <h3>{slide.title}</h3>
          <p>{slide.detail}</p>
        </div>
        <div className="dashboard-carousel__controls" aria-label="Carousel controls">
          <div className="dashboard-carousel__dots">
            {heartSlides.map((item, index) => (
              <button
                key={item.image}
                type="button"
                className={`dashboard-carousel__dot ${index === activeSlide ? "is-active" : ""}`}
                aria-label={`Show slide ${index + 1}: ${item.title}`}
                aria-current={index === activeSlide ? "true" : undefined}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
          <div className="dashboard-carousel__buttons">
            <button type="button" aria-label="Previous slide" onClick={() => moveSlide(-1)}><ArrowLeft size={15} /></button>
            <button
              type="button"
              aria-label={isPaused ? "Play carousel" : "Pause carousel"}
              aria-pressed={isPaused}
              onClick={() => setIsPaused((paused) => !paused)}
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button type="button" aria-label="Next slide" onClick={() => moveSlide(1)}><ArrowRight size={15} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { metrics } = useModelAnalysis();
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [telegramNoticeError, setTelegramNoticeError] = useState("");
  const [telegramNoticeMessageId, setTelegramNoticeMessageId] = useState<number | null>(null);

  async function refreshDashboard() {
    setRefreshing(true);
    const [historyResult, healthResult] = await Promise.allSettled([fetchHistory(), fetchHealth()]);
    if (historyResult.status === "fulfilled") {
      setRecords(historyResult.value);
      setHistoryError(null);
    } else {
      setHistoryError(historyResult.reason instanceof PredictionApiError ? historyResult.reason.message : "Prediction history is unavailable.");
    }
    setBackendReady(healthResult.status === "fulfilled");
    setRefreshing(false);
  }

  useEffect(() => {
    const noticeTimer = window.setTimeout(() => {
      try {
        const noticeError = window.sessionStorage.getItem("cardio-telegram-notification-error");
        const messageId = window.sessionStorage.getItem("cardio-telegram-notification-sent");
        if (noticeError) {
          window.sessionStorage.removeItem("cardio-telegram-notification-error");
          setTelegramNoticeError(noticeError);
        }
        if (messageId && /^\d+$/.test(messageId)) {
          window.sessionStorage.removeItem("cardio-telegram-notification-sent");
          setTelegramNoticeMessageId(Number(messageId));
        }
      } catch {
        setTelegramNoticeError("Could not confirm whether the Telegram sign-in notice was delivered.");
      }
    }, 0);
    const timer = window.setTimeout(() => void refreshDashboard(), 0);
    return () => {
      window.clearTimeout(noticeTimer);
      window.clearTimeout(timer);
    };
  }, []);

  const recentRecords = records?.slice(0, 5) ?? [];

  return (
    <AppShell title="Dashboard" subtitle="Prediction activity and final model status.">
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div className="dashboard-hero__content">
            <p className="dashboard-hero__eyebrow"><span /> Your cardiovascular research workspace</p>
            <h2>Heart health,<br /><em>in focus.</em></h2>
            <p className="dashboard-hero__description">
              Explore heart-health insights and review prediction activity, or start a new assessment with the validated 1D CNN.
            </p>
            <div className="dashboard-hero__actions">
              <Link href="/predict" className="primary-button"><Stethoscope size={16} /> New Prediction</Link>
              <Link href="/predict?mode=csv" className="secondary-button"><FileSpreadsheet size={16} /> CSV Prediction</Link>
            </div>
            <div className="dashboard-status-row">
              <StatusBadge>Final Model</StatusBadge>
              <StatusBadge>Validated</StatusBadge>
              <span className={`backend-status ${backendReady === true ? "is-ready" : backendReady === false ? "is-down" : "is-checking"}`}>
                <span aria-hidden="true" />
                {backendReady === true ? "Ready for Prediction" : backendReady === false ? "Backend unavailable" : "Checking backend"}
              </span>
            </div>
          </div>
          <div className="dashboard-hero__visual"><HeartCarousel /></div>
        </section>
        {telegramNoticeError ? (
          <p className="dashboard-notification-error" role="alert">
            Telegram sign-in notice was not delivered: {telegramNoticeError}
          </p>
        ) : null}
        {telegramNoticeMessageId !== null ? (
          <p className="dashboard-notification-success" role="status">
            Telegram accepted your sign-in notification. Message ID: {telegramNoticeMessageId}. Open the chat with @Heart74bot to find it.
          </p>
        ) : null}

        <section className="dashboard-metrics" aria-label="Prediction and model overview">
          <article className="dashboard-metric-card"><span>Total Predictions</span><strong>{records === null ? "—" : records.length.toLocaleString()}</strong><small>Persisted by the backend</small></article>
          <article className="dashboard-metric-card"><span>Current Model</span><strong>{modelMetrics.modelName}</strong><small>Final frozen model</small></article>
          <article className="dashboard-metric-card"><span>Test Accuracy</span><strong>{formatModelPercent(metrics.testAccuracy)}</strong><small>Held-out evaluation</small></article>
          <article className="dashboard-metric-card"><span>Model Status</span><strong className="dashboard-status-value">{backendReady === true ? "Ready" : backendReady === false ? "Offline" : "Checking"}</strong><small>Live backend health</small></article>
        </section>

        <section className="dashboard-panel dashboard-panel--wide">
          <div className="dashboard-panel__header">
            <div><p className="dashboard-panel__eyebrow">Final model</p><h3>{modelMetrics.modelName}</h3></div>
            <StatusBadge>Final frozen model</StatusBadge>
          </div>
          <div className="dashboard-pipeline" aria-label="Model methodology">
            {["23 Clinical Features", "Preprocessing", "1D CNN", "7-Class Classification"].map((step, index) => (
              <div className="dashboard-pipeline__step" key={step}>
                <span className="dashboard-pipeline__number">{index + 1}</span><span>{step}</span>
                {index < 3 ? <ArrowRight className="dashboard-pipeline__arrow" size={14} aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
          <p className="dashboard-model-note"><Gauge size={15} /> Test accuracy {formatModelPercent(metrics.testAccuracy)}.</p>
        </section>

        <div className="dashboard-lower-grid">
          <section className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div><p className="dashboard-panel__eyebrow">Persistent activity</p><h3>Recent Predictions</h3></div>
              <Link href="/history" className="dashboard-text-link">View history <ArrowRight size={14} /></Link>
            </div>
            {historyError ? (
              <div className="dashboard-inline-error" role="alert"><CircleAlert size={17} /><span>{historyError}</span><button type="button" onClick={() => void refreshDashboard()} aria-label="Retry loading history"><RefreshCw size={15} /></button></div>
            ) : records === null ? (
              <p className="dashboard-loading" aria-live="polite">Loading saved predictions...</p>
            ) : recentRecords.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state__icon"><Activity size={20} /></div>
                <div><strong>No saved predictions</strong><p>Completed predictions will appear here from backend history.</p></div>
                <Link href="/predict" className="primary-button">New Prediction</Link>
              </div>
            ) : (
              <div className="dashboard-history-list">
                {recentRecords.map((record) => (
                  <article className="dashboard-history-item" key={record.id}>
                    <div><span className="dashboard-history-item__label">{record.uploaded_file_name} · #{record.record_index}</span><small>{formatTimestamp(record.prediction_timestamp)}</small></div>
                    <div><span className="dashboard-history-item__label">Prediction</span><strong>{record.prediction_label}</strong></div>
                    <div><span className="dashboard-history-item__label">Confidence</span><strong>{formatConfidence(record.prediction_confidence)}</strong></div>
                    <div><span className="dashboard-history-item__label">Type</span><strong>{record.prediction_type === "CSV" ? "CSV" : "Single"}</strong></div>
                  </article>
                ))}
              </div>
            )}
            {refreshing ? <small className="dashboard-refresh-note" aria-live="polite">Refreshing backend records…</small> : null}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel__header"><div><p className="dashboard-panel__eyebrow">Workflows</p><h3>Prediction Tools</h3></div></div>
            <div className="dashboard-actions">
              <Link href="/predict" className="dashboard-action-card"><span className="dashboard-action-card__icon"><Stethoscope size={18} /></span><div><strong>New Prediction</strong><small>Enter one patient record</small></div><ArrowRight size={15} /></Link>
              <Link href="/predict?mode=csv" className="dashboard-action-card"><span className="dashboard-action-card__icon"><FileSpreadsheet size={18} /></span><div><strong>CSV Prediction</strong><small>Process a validated feature file</small></div><ArrowRight size={15} /></Link>
              <Link href="/history" className="dashboard-action-card"><span className="dashboard-action-card__icon"><Clock3 size={18} /></span><div><strong>History</strong><small>Review persistent records</small></div><ArrowRight size={15} /></Link>
            </div>
          </section>
        </div>

        <p className="dashboard-disclaimer">Research and decision-support prototype only; predictions are not a medical diagnosis. Consult a qualified healthcare professional for clinical decisions.</p>
      </div>
    </AppShell>
  );
}