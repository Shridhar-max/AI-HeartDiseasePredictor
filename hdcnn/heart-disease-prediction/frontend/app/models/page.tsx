"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowDown, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { formatModelPercent, useModelAnalysis } from "@/components/model-analysis-provider";
import { fetchHealth, type ModelAnalysis } from "@/lib/api";
import { formatPercent, modelMetrics } from "@/lib/model-metrics";

const fallbackFeatureNames = [
  "Age", "Gender", "BMI", "Resting_BP", "Serum_Cholesterol", "Fasting_Blood_Sugar",
  "Max_Heart_Rate", "ST_Depression_Oldpeak", "Ejection_Fraction", "Troponin_Level",
  "BNP_Level", "CRP_Level", "WBC_Count", "HRV_SDNN", "Resting_Respiratory_Rate", "SpO2",
  "Triglycerides", "LDL_Cholesterol", "HDL_Cholesterol", "Cigarettes_Per_Day",
  "Family_History", "Diabetes_Status", "Alcohol_ml_Per_Day",
];

const architecture = ["23 Clinical Features", "Preprocessing", "1D CNN", "Feature Learning", "Dense Layer", "Softmax", "7 Disease Classes"];
const productionPipeline = ["Patient Input / CSV", "Input Validation", "Preprocessing", "Final 1D CNN", "7-Class Probability Output", "Predicted Class", "Confidence"];

function classMetric(analysis: ModelAnalysis, classId: number, metric: "precision" | "recall" | "f1-score" | "support") {
  const report = analysis.classification_report[String(classId)];
  return typeof report === "object" && report !== null && typeof report[metric] === "number" ? report[metric] : null;
}

function metricPercent(value: number | null) {
  return value === null ? "Not available" : formatPercent(value * 100);
}

function classColor(value: number) {
  const opacity = Math.max(0.08, Math.min(value, 1) * 0.82);
  return `rgba(105, 35, 46, ${opacity})`;
}

function correlationColor(value: number) {
  const opacity = Math.max(0.08, Math.min(Math.abs(value), 1) * 0.78);
  return value >= 0 ? `rgba(105, 35, 46, ${opacity})` : `rgba(28, 111, 103, ${opacity})`;
}

export default function ModelsPage() {
  const { analysis, error, isLoading, metrics: liveMetrics, refresh } = useModelAnalysis();
  const [backendReady, setBackendReady] = useState<boolean | null>(null);

  async function checkBackend() {
    try {
      await fetchHealth();
      setBackendReady(true);
    } catch {
      setBackendReady(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void checkBackend(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const metrics = [
    { label: "Test Accuracy", value: liveMetrics.testAccuracy, primary: true },
    { label: "Macro Precision", value: liveMetrics.macroPrecision },
    { label: "Macro Recall", value: liveMetrics.macroRecall },
    { label: "Macro F1", value: liveMetrics.macroF1 },
    { label: "Weighted F1", value: liveMetrics.weightedF1 },
  ];
  const featureNames = analysis?.feature_names?.length === 23 ? analysis.feature_names : fallbackFeatureNames;
  const classLabels = analysis?.class_labels ?? {};
  const classIds = Object.keys(classLabels).sort((left, right) => Number(left) - Number(right));
  const selectedMiFeatures = analysis?.selected_features?.length ? analysis.selected_features : (analysis?.mi_feature_ranking ?? []).map((item) => item.feature);
  const topFeatures = [...(analysis?.feature_importance ?? [])].sort((left, right) => right.importance - left.importance).slice(0, 12);
  const maxImportance = Math.max(...topFeatures.map((item) => item.importance), 0.01);

  return (
    <AppShell title="Model Analysis" subtitle="Performance and architecture overview of the finalized heart disease classification model.">
      <div className="model-analysis-page">
        <section className="model-analysis-hero">
          <div>
            <p className="eyebrow"><span className="eyebrow__line" /> Final model</p>
            <h2>{modelMetrics.modelName}</h2>
            <p>One finalized CNN model for research and decision-support workflows. Model weights and evaluation split are frozen.</p>
          </div>
          <div className="model-analysis-hero__image"><Image src="/images/anatomical-heart.png" alt="Anatomical illustration of a human heart" width={540} height={540} priority /></div>
          <div className="model-analysis-statuses"><StatusBadge>Final Model</StatusBadge><StatusBadge>Validated</StatusBadge></div>
        </section>

        <section className="model-analysis-section" aria-labelledby="overview-title">
          <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Model overview</p><h3 id="overview-title">Finalized model record</h3></div><span className="model-live-status"><span className={backendReady === true ? "is-ready" : "is-down"} /> {backendReady === true ? "Backend connected" : backendReady === false ? "Backend unavailable" : "Checking backend"}</span></div>
          <div className="model-overview-grid">
            <OverviewItem label="Model" value="1D CNN" />
            <OverviewItem label="Input" value="23 Clinical Features" />
            <OverviewItem label="Classes" value="7 Disease Classes" />
            <OverviewItem label="Status" value="Final Frozen Model" />
          </div>
          <div className="model-primary-metric"><span>Test Accuracy</span><strong>{formatModelPercent(liveMetrics.testAccuracy)}</strong><small>Held-out evaluation of the finalized model</small></div>
        </section>

        <section className="model-analysis-section" aria-labelledby="metrics-title">
          <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Performance metrics</p><h3 id="metrics-title">Measured evaluation</h3></div></div>
          <div className="model-metrics-grid">{metrics.map((metric) => <article className={`model-metric-card ${metric.primary ? "model-metric-card--primary" : ""}`} key={metric.label}><span>{metric.label}</span><strong>{formatModelPercent(metric.value)}</strong></article>)}</div>
        </section>

        <section className="model-analysis-section" aria-labelledby="architecture-title">
          <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Architecture</p><h3 id="architecture-title">Verified high-level flow</h3></div></div>
          <div className="model-flow">{architecture.map((step, index) => <div className="model-flow__step" key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < architecture.length - 1 ? <ArrowDown size={16} aria-hidden="true" /> : null}</div>)}</div>
          <p className="model-note">Exact layer-level configuration is not exposed by the current model-analysis API.</p>
        </section>

        <div className="model-analysis-two-column">
          <section className="model-analysis-section" aria-labelledby="features-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Data input</p><h3 id="features-title">23 clinical features</h3></div></div>
            <div className="model-feature-grid">{featureNames.map((feature) => <span key={feature}>{feature.replaceAll("_", " ")}</span>)}</div>
          </section>
          <section className="model-analysis-section" aria-labelledby="classes-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Classification output</p><h3 id="classes-title">Seven disease classes</h3></div></div>
            <div className="model-class-list">{Object.keys(classLabels).length ? Object.entries(classLabels).sort(([left], [right]) => Number(left) - Number(right)).map(([classId, label]) => <div key={classId}><span>Class {classId}</span><strong>{label}</strong></div>) : <p className="model-empty">Class mapping unavailable.</p>}</div>
          </section>
        </div>

        {selectedMiFeatures.length ? <section className="model-analysis-section" aria-labelledby="mi-features-title">
          <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Feature selection</p><h3 id="mi-features-title">MI selected features</h3></div></div>
          <div className="model-feature-grid">{selectedMiFeatures.map((feature) => <span key={feature}>{feature.replaceAll("_", " ")}</span>)}</div>
        </section> : null}

        {analysis ? <>
          <section className="model-analysis-section" aria-labelledby="visualization-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Model performance visualization</p><h3 id="visualization-title">Per-class evaluation</h3></div><span className="model-api-status"><ShieldCheck size={14} /> Loaded from /model-analysis</span></div>
            <div className="model-performance-bars">{Object.keys(classLabels).sort((left, right) => Number(left) - Number(right)).map((classId) => <div className="model-performance-row" key={classId}><span>Class {classId}</span><div><i style={{ width: `${(classMetric(analysis, Number(classId), "f1-score") ?? 0) * 100}%` }} /></div><strong>{metricPercent(classMetric(analysis, Number(classId), "f1-score"))}</strong></div>)}</div>
          </section>

          <section className="model-analysis-section" aria-labelledby="matrix-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Confusion matrix</p><h3 id="matrix-title">Confusion Matrix</h3></div></div>
            <p className="model-note">The confusion matrix shows how frequently each actual disease class was classified into each predicted class.</p>
            {analysis.confusion_matrix?.length === classIds.length ? <div className="model-table-wrap"><table className="model-confusion-table"><caption>Rows are actual classes; columns are predicted classes. Darker cells indicate more test records.</caption><thead><tr><th>Actual / Predicted</th>{classIds.map((classId) => <th key={classId}>Class {classId}</th>)}</tr></thead><tbody>{analysis.confusion_matrix.map((row, rowIndex) => <tr key={rowIndex}><th>Class {rowIndex}: {classLabels[String(rowIndex)]}</th>{row.map((value, columnIndex) => <td key={columnIndex} style={{ backgroundColor: classColor(value / Math.max(...row, 1)), color: value / Math.max(...row, 1) > 0.55 ? "#fff" : "var(--ink)" }} title={`${value} records`}>{value}</td>)}</tr>)}</tbody></table></div> : <p className="model-empty">Confusion matrix not available.</p>}
          </section>

          <div className="model-chart-grid">
            <section className="model-analysis-section model-chart-panel" aria-labelledby="feature-importance-title">
              <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Feature analysis</p><h3 id="feature-importance-title">Most influential inputs</h3></div></div>
              {topFeatures.length ? <div className="model-feature-chart">{topFeatures.map((item, index) => <div className="model-feature-chart__row" key={item.feature}><span className="model-feature-chart__rank">{String(index + 1).padStart(2, "0")}</span><span className="model-feature-chart__name">{item.feature.replaceAll("_", " ")}</span><div className="model-feature-chart__track"><i style={{ width: `${(item.importance / maxImportance) * 100}%` }} /></div><strong>{item.importance.toFixed(3)}</strong></div>)}</div> : <p className="model-empty">Feature importance is not available.</p>}
              <p className="model-note">Importance scores describe the model-analysis ranking, not a causal effect or clinical risk.</p>
            </section>

            <section className="model-analysis-section model-chart-panel" aria-labelledby="class-distribution-title">
              <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Evaluation data</p><h3 id="class-distribution-title">Test-set class distribution</h3></div></div>
              <div className="model-distribution-chart">{analysis.class_distribution.map((item) => <div className="model-distribution-row" key={item.class_id}><div className="model-distribution-row__label"><span>Class {item.class_id}</span><strong>{item.label}</strong></div><div className="model-feature-chart__track"><i style={{ width: `${Math.min(item.percentage, 100)}%` }} /></div><small>{item.test_count.toLocaleString()} · {item.percentage.toFixed(1)}%</small></div>)}</div>
            </section>

            <section className="model-analysis-section model-chart-panel model-chart-panel--wide" aria-labelledby="class-metrics-chart-title">
              <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Class-level performance</p><h3 id="class-metrics-chart-title">Precision, recall and F1 score</h3></div></div>
              <div className="model-grouped-chart">{classIds.map((classId) => <div className="model-grouped-chart__row" key={classId}><span>Class {classId}: {classLabels[classId]}</span><div className="model-grouped-chart__bars">{(["precision", "recall", "f1-score"] as const).map((metric) => <div className="model-grouped-chart__bar" key={metric}><i className={`is-${metric === "f1-score" ? "f1" : metric}`} style={{ width: `${(classMetric(analysis, Number(classId), metric) ?? 0) * 100}%` }} /><small>{metricPercent(classMetric(analysis, Number(classId), metric))}</small></div>)}</div></div>)}</div>
              <div className="model-chart-legend"><span><i className="is-precision" /> Precision</span><span><i className="is-recall" /> Recall</span><span><i className="is-f1" /> F1 score</span></div>
            </section>
          </div>

          <section className="model-analysis-section" aria-labelledby="correlation-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Feature relationships</p><h3 id="correlation-title">Clinical feature correlation map</h3></div><span className="model-api-status"><ShieldCheck size={14} /> {analysis.correlation_features.length} features</span></div>
            <p className="model-note">Positive correlations use burgundy; negative correlations use teal. Hover a cell to inspect its feature pair and coefficient.</p>
            {analysis.correlation_matrix?.length === analysis.correlation_features.length ? <div className="model-correlation-wrap"><table className="model-correlation-table" aria-label="Feature correlation heatmap"><thead><tr><th>Feature</th>{analysis.correlation_features.map((feature) => <th key={feature}>{feature.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{analysis.correlation_matrix.map((row, rowIndex) => <tr key={analysis.correlation_features[rowIndex]}><th>{analysis.correlation_features[rowIndex].replaceAll("_", " ")}</th>{row.map((value, columnIndex) => <td key={`${analysis.correlation_features[rowIndex]}-${analysis.correlation_features[columnIndex]}`} style={{ backgroundColor: correlationColor(value), color: Math.abs(value) > 0.75 ? "#fff" : "var(--ink)" }} title={`${analysis.correlation_features[rowIndex].replaceAll("_", " ")} × ${analysis.correlation_features[columnIndex].replaceAll("_", " ")}: ${value.toFixed(2)}`} aria-label={`${analysis.correlation_features[rowIndex]} and ${analysis.correlation_features[columnIndex]} correlation ${value.toFixed(2)}`}>{value.toFixed(2)}</td>)}</tr>)}</tbody></table></div> : <p className="model-empty">Correlation map not available.</p>}
            <div className="model-correlation-legend"><span><i className="is-negative" /> Negative</span><span><i className="is-neutral" /> Near zero</span><span><i className="is-positive" /> Positive</span></div>
          </section>

          <section className="model-analysis-section" aria-labelledby="class-metrics-title">
            <div className="model-section-heading"><div><p className="eyebrow"><span className="eyebrow__line" /> Classification metrics</p><h3 id="class-metrics-title">Per-class report</h3></div></div>
            <div className="model-table-wrap"><table className="model-report-table"><thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1 Score</th><th>Support</th></tr></thead><tbody>{Object.keys(classLabels).sort((left, right) => Number(left) - Number(right)).map((classId) => <tr key={classId}><th>Class {classId}: {classLabels[classId]}</th><td>{metricPercent(classMetric(analysis, Number(classId), "precision"))}</td><td>{metricPercent(classMetric(analysis, Number(classId), "recall"))}</td><td>{metricPercent(classMetric(analysis, Number(classId), "f1-score"))}</td><td>{classMetric(analysis, Number(classId), "support")?.toLocaleString() ?? "Not available"}</td></tr>)}</tbody></table></div>
          </section>

        </> : null}

        {isLoading ? <p className="model-api-message" aria-live="polite">Loading model analysis...</p> : null}
        {error ? <div className="model-api-error" role="alert"><AlertTriangle size={16} /><span><strong>Model analysis unavailable</strong><br />Unable to retrieve model analysis from the backend. The verified final model summary remains available.</span><button type="button" className="secondary-button" onClick={() => void refresh()}><RefreshCw size={14} /> Retry</button></div> : null}
        <p className="model-disclaimer">Research and educational use only. This machine-learning prediction is not a medical diagnosis and should not replace professional medical advice.</p>
      </div>
    </AppShell>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return <div className="model-overview-item"><span>{label}</span><strong>{value}</strong></div>;
}