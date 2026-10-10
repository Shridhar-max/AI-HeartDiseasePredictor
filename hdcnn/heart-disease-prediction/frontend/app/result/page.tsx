"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PredictionResult } from "@/components/PredictionResult";
import { fetchModelAnalysis, type PredictionResponse } from "@/lib/api";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [classLabels, setClassLabels] = useState<Record<string, string>>({});
  const [telegramNotification, setTelegramNotification] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const resultTimer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem("cardio-last-prediction");
        if (!raw) return;
        const parsed = JSON.parse(raw) as PredictionResponse;
        if (parsed && typeof parsed.predicted_class === "number") setResult(parsed);
      } catch {
        setResult(null);
      }
    }, 0);
    const notificationTimer = window.setTimeout(() => {
      try {
        const status = window.sessionStorage.getItem("cardio-prediction-telegram-status");
        if (!status) return;
        window.sessionStorage.removeItem("cardio-prediction-telegram-status");
        setTelegramNotification(
          status === "sent"
            ? "The prediction summary was automatically sent to Telegram."
            : `The prediction completed, but the Telegram report was not delivered: ${status.replace(/^error:/, "")}`,
        );
      } catch {
        setTelegramNotification("The prediction completed, but Telegram delivery could not be confirmed.");
      }
    }, 0);

    fetchModelAnalysis()
      .then((analysis) => {
        if (active) setClassLabels(analysis.class_labels);
      })
      .catch(() => {
        if (active) setClassLabels({});
      });
    return () => {
      active = false;
      window.clearTimeout(resultTimer);
      window.clearTimeout(notificationTimer);
    };
  }, []);

  function handleNewPrediction() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("cardio-last-prediction");
    }
    setResult(null);
    router.push("/predict");
  }

  return (
    <AppShell title="Latest Result" subtitle="Most recent model output from the live prediction workflow.">
      {result ? (
        <>
          <PredictionResult
            result={result}
            classLabels={classLabels}
            onNewPrediction={handleNewPrediction}
            onReturnToDashboard={() => router.push("/dashboard")}
          />
          {telegramNotification ? (
            <p className={`prediction-telegram-status ${telegramNotification.startsWith("The prediction completed, but") ? "is-error" : ""}`} role={telegramNotification.startsWith("The prediction completed, but") ? "alert" : "status"}>
              {telegramNotification}
            </p>
          ) : null}
        </>
      ) : (
        <section className="content-card empty-state empty-state--result">
          <strong>No prediction result available.</strong>
          <p>Run a prediction to populate this screen with a live model output.</p>
          <Link href="/predict" className="primary-button">Create New Prediction</Link>
        </section>
      )}
    </AppShell>
  );
}
