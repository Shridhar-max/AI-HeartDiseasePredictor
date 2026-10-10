"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Activity, ArrowDown, ArrowUp, BarChart3, Clock3, Gauge, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { formatModelPercent, useModelAnalysis } from "@/components/model-analysis-provider";
import { modelMetrics } from "@/lib/model-metrics";
import type { PredictionResponse } from "@/lib/api";

interface PredictionResultProps {
  result: PredictionResponse;
  classLabels?: Record<string, string>;
  onNewPrediction: () => void;
  onReturnToDashboard?: () => void;
}

export function PredictionResult({ result, classLabels = {}, onNewPrediction, onReturnToDashboard }: PredictionResultProps) {
  const { metrics } = useModelAnalysis();
  const confidencePercent = Number.isFinite(result.confidence)
    ? Math.min(Math.max(result.confidence * 100, 0), 100)
    : 0;
  const affectedAttributes = result.affected_attributes ?? [];
  const impactChartItems = affectedAttributes.slice(0, 10);
  const impactMax = Math.max(...impactChartItems.map((attribute) => attribute.impact_score), 1);

  const timestamp = typeof window !== "undefined"
    ? new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "";

  return (
    <motion.section
      className="prediction-result"
      aria-labelledby="prediction-result-title"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="prediction-result__header">
        <div className="prediction-result__heading-wrap">
          <p className="eyebrow"><span className="eyebrow__line" /> Prediction Result</p>
          <h2 id="prediction-result-title">Analysis Complete</h2>
          <p className="prediction-result__intro">Review the model&apos;s classification result and prediction confidence.</p>
          {timestamp ? (
            <div className="prediction-result__timestamp">
              <Clock3 size={15} /> {timestamp}
            </div>
          ) : null}
        </div>

        <div className="prediction-result__class">
          <span>PREDICTED CLASS</span>
          <strong>Class {result.predicted_class}</strong>
          <small>{result.predicted_label}</small>
        </div>
      </div>

      <div className="prediction-result__main">
        <div className="confidence-panel">
          <div className="confidence-ring" style={{ ["--confidence" as string]: `${confidencePercent}%` }}>
            <div className="confidence-ring__inner">
              <strong>{confidencePercent.toFixed(2)}%</strong>
              <span>Model Confidence</span>
            </div>
          </div>
        </div>

        <div className="probability-panel">
          <div className="probability-panel__heading">
            <span>Class Probability Distribution</span>
            <small>{Object.keys(result.probabilities).length} classes</small>
          </div>

          <div className="probability-list">
            {Object.entries(result.probabilities).sort(([left], [right]) => Number(left) - Number(right)).map(([classNumber, rawProbability]) => {
              const index = Number(classNumber);
              const probability = Math.min(Math.max(rawProbability, 0), 0.9999);
              const isPredicted = index === result.predicted_class;
              const displayPercent = Math.min(probability * 100, 99.99);
              return (
                <motion.div
                  key={index}
                  className={`probability-row ${isPredicted ? "probability-row--active" : ""}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  <span className="probability-row__label">{classLabels[String(index)] ?? `Class ${index}`}{isPredicted ? <b>Predicted</b> : null}</span>
                  <div className="probability-track">
                    <motion.span initial={{ width: 0 }} animate={{ width: `${displayPercent}%` }} transition={{ duration: 0.7, delay: index * 0.06 }} />
                  </div>
                  <span className="probability-row__value">{displayPercent.toFixed(2)}%</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="result-summary" aria-label="Prediction summary">
        <div className="result-summary__heading"><ShieldCheck size={16} /> <span>Prediction Summary</span></div>
        <p>
          The 1D CNN classified the submitted patient attributes as {result.predicted_label} with a model confidence of {confidencePercent.toFixed(2)}%.
        </p>
      </div>

      <section className="impact-analysis" aria-labelledby="impact-analysis-title">
        <div className="impact-analysis__header">
          <div>
            <p className="eyebrow"><span className="eyebrow__line" /> Predicted-class sensitivity</p>
            <h3 id="impact-analysis-title">Attributes affecting {result.predicted_label}</h3>
            <p>Scores show how the model&apos;s odds for {result.predicted_label} change when each attribute is compared with typical dataset values. Scores are relative to the most-sensitive attribute in this report; they describe model sensitivity, not clinical causes.</p>
          </div>
          <div className="impact-legend" aria-label="Impact level legend">
            <span><i className="impact-dot impact-dot--high" /> High</span>
            <span><i className="impact-dot impact-dot--medium" /> Moderate</span>
            <span><i className="impact-dot impact-dot--low" /> Low</span>
          </div>
        </div>

        {affectedAttributes.length > 0 ? (
          <>
            <div className="impact-chart" role="img" aria-label="Bar chart of affected attributes and their impact scores">
              {impactChartItems.map((attribute, index) => {
                const width = Math.max(4, (attribute.impact_score / impactMax) * 100);
                const isIncrease = attribute.direction.includes("increases");
                const isDecrease = attribute.direction.includes("decreases");
                return (
                  <div className="impact-chart__row" key={attribute.feature}>
                    <div className="impact-chart__label">
                      <strong>{attribute.feature.replace(/_/g, " ")}</strong>
                      <span>Current: {String(attribute.current_value)}</span>
                    </div>
                    <div className="impact-chart__track">
                      <motion.span
                        className={`impact-chart__fill impact-chart__fill--${attribute.impact_level}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.65, delay: index * 0.04 }}
                      />
                    </div>
                    <div className="impact-chart__score">
                      <strong>{Math.round(attribute.impact_score * 100)}%</strong>
                      <span>{isIncrease ? <ArrowUp size={12} /> : isDecrease ? <ArrowDown size={12} /> : null}{attribute.impact_level}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="impact-details-grid">
              {impactChartItems.map((attribute) => (
                <article className={`impact-card impact-card--${attribute.impact_level}`} key={attribute.feature}>
                  <div className="impact-card__icon"><BarChart3 size={18} /></div>
                  <div>
                    <span>{attribute.feature.replace(/_/g, " ")}</span>
                    <strong>{Math.round(attribute.impact_score * 100)}% impact</strong>
                    <p>Current {String(attribute.current_value)} · {attribute.direction}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="impact-empty">No affected-attribute analysis was returned for this prediction.</div>
        )}
      </section>

      <div className="result-model-metrics" aria-label="Frozen model metrics">
        <div><span>Model</span><strong>{modelMetrics.modelName}</strong></div>
        <div><span>Test Accuracy</span><strong>{formatModelPercent(metrics.testAccuracy)}</strong></div>
        <div><span>Macro Precision</span><strong>{formatModelPercent(metrics.macroPrecision)}</strong></div>
        <div><span>Macro Recall</span><strong>{formatModelPercent(metrics.macroRecall)}</strong></div>
        <div><span>Macro F1</span><strong>{formatModelPercent(metrics.macroF1)}</strong></div>
        <div><span>Weighted F1</span><strong>{formatModelPercent(metrics.weightedF1)}</strong></div>
      </div>

      <div className="prediction-result__footer">
        <div className="result-action-row">
          <motion.button className="primary-button" type="button" onClick={onNewPrediction} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <RotateCcw size={15} /> New Prediction
          </motion.button>

          <button className="secondary-button" type="button" onClick={() => window.print()}>
            <Printer size={15} /> Print Report
          </button>

          <Link href="/history" className="secondary-button">
            <Activity size={15} /> View Prediction History
          </Link>

          <button className="secondary-button secondary-button--ghost" type="button" onClick={onReturnToDashboard}>
            <Gauge size={15} /> Return to Dashboard
          </button>
        </div>
      </div>

      <div className="result-disclaimer">
        <ShieldCheck size={16} />
        <span>This system is a research/decision-support prototype and is not a medical diagnosis. Consult a qualified healthcare professional for clinical decisions.</span>
      </div>
    </motion.section>
  );
}
