import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PredictionForm } from "@/components/PredictionForm";

export default function PredictPage() {
  return (
    <AppShell
      title="Clinical Risk Screening"
      subtitle="Enter the full patient profile to generate a heart disease risk assessment using the validated heart disease prediction model."
      action={<div className="prediction-header-badge">23 Features • 7-Class Model</div>}
    >
      <Suspense fallback={<div className="content-card" role="status">Loading prediction workspace...</div>}>
        <PredictionForm />
      </Suspense>
    </AppShell>
  );
}
