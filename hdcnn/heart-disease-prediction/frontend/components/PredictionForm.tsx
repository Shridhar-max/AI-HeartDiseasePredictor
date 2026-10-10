"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import { Activity, ChevronDown, Clipboard, FileUp, FlaskConical, Gauge, LoaderCircle, RotateCcw, Send, TriangleAlert, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatModelPercent, useModelAnalysis } from "@/components/model-analysis-provider";
import { fetchFeatureMetadata, predictCsv, predictPatient, PredictionApiError, type CsvPredictionResponse, type FeatureMetadataResponse, type PatientData, type PredictionResponse } from "@/lib/api";
import { validatePredictionCsv } from "@/lib/csv-validation";
import { sendPredictionReport } from "@/lib/telegram-notifications";
import { PredictionResult } from "@/components/PredictionResult";
import { CsvResultsPanel } from "@/components/CsvResultsPanel";

const numericalFields = [
  "Age",
  "BMI",
  "Resting_BP",
  "Serum_Cholesterol",
  "Fasting_Blood_Sugar",
  "Max_Heart_Rate",
  "ST_Depression_Oldpeak",
  "Ejection_Fraction",
  "Troponin_Level",
  "BNP_Level",
  "CRP_Level",
  "WBC_Count",
  "HRV_SDNN",
  "Resting_Respiratory_Rate",
  "SpO2",
  "Triglycerides",
  "LDL_Cholesterol",
  "HDL_Cholesterol",
  "Cigarettes_Per_Day",
  "Alcohol_ml_Per_Day",
] as const;

const categoricalFields = [
  "Gender",
  "Family_History",
  "Diabetes_Status",
] as const;

type NumericalField = (typeof numericalFields)[number];
type CategoricalField = (typeof categoricalFields)[number];
type FeatureKey = NumericalField | CategoricalField;
type FormValues = Record<FeatureKey, string>;
type FormErrors = Partial<Record<FeatureKey, string>>;

type FieldConfig = {
  key: FeatureKey;
  label: string;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
  options?: readonly { value: string; label: string }[];
};

type SectionConfig = {
  id: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  fields: FieldConfig[];
};

const initialValues = [...numericalFields, ...categoricalFields].reduce((values, key) => {
  values[key] = "";
  return values;
}, {} as FormValues);

const sections: SectionConfig[] = [
  {
    id: "demographics",
    eyebrow: "01 / Patient profile",
    title: "Patient Demographics",
    icon: UserRound,
    fields: [
      { key: "Age", label: "Age", unit: "years", step: "1" },
      { key: "Gender", label: "Gender" },
    ],
  },
  {
    id: "lifestyle",
    eyebrow: "02 / Context",
    title: "Lifestyle & Medical History",
    icon: Clipboard,
    fields: [
      { key: "Cigarettes_Per_Day", label: "Cigarettes per day", step: "0.1" },
      { key: "Alcohol_ml_Per_Day", label: "Alcohol intake", unit: "ml / day", step: "0.1" },
      { key: "Family_History", label: "Family history" },
      { key: "Diabetes_Status", label: "Diabetes status" },
    ],
  },
  {
    id: "vitals",
    eyebrow: "03 / Vital signs",
    title: "Vital Signs",
    icon: Gauge,
    fields: [
      { key: "Resting_BP", label: "Resting blood pressure", unit: "mmHg", step: "0.1" },
      { key: "Max_Heart_Rate", label: "Maximum heart rate", unit: "bpm", step: "1" },
      { key: "Resting_Respiratory_Rate", label: "Resting respiratory rate", unit: "breaths / min", step: "0.1" },
      { key: "SpO2", label: "Oxygen saturation", unit: "%", step: "0.1" },
    ],
  },
  {
    id: "laboratory",
    eyebrow: "04 / Laboratory",
    title: "Body & Laboratory Measurements",
    icon: FlaskConical,
    fields: [
      { key: "BMI", label: "Body mass index", unit: "kg / m²", step: "0.1" },
      { key: "Serum_Cholesterol", label: "Serum cholesterol", unit: "mg / dL", step: "0.1" },
      { key: "Triglycerides", label: "Triglycerides", unit: "mg / dL", step: "0.1" },
      { key: "LDL_Cholesterol", label: "LDL cholesterol", unit: "mg / dL", step: "0.1" },
      { key: "HDL_Cholesterol", label: "HDL cholesterol", unit: "mg / dL", step: "0.1" },
      { key: "Fasting_Blood_Sugar", label: "Fasting blood sugar", unit: "mg / dL", step: "0.1" },
      { key: "CRP_Level", label: "C-reactive protein", unit: "mg / L", step: "0.01" },
      { key: "BNP_Level", label: "B-type natriuretic peptide", unit: "pg / mL", step: "0.1" },
      { key: "Troponin_Level", label: "Troponin level", unit: "ng / mL", step: "0.001" },
      { key: "WBC_Count", label: "White blood cell count", unit: "cells / µL", step: "1" },
    ],
  },
  {
    id: "cardiac",
    eyebrow: "05 / Cardiac measures",
    title: "Cardiac Measurements",
    icon: Activity,
    fields: [
      { key: "ST_Depression_Oldpeak", label: "ST depression (oldpeak)", unit: "mm", step: "0.01" },
      { key: "Ejection_Fraction", label: "Ejection fraction", unit: "%", step: "0.1" },
      { key: "HRV_SDNN", label: "Heart-rate variability SDNN", unit: "ms", step: "0.1" },
    ],
  },
];

function validate(values: FormValues, metadata: FeatureMetadataResponse | null): FormErrors {
  const errors: FormErrors = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const value = values[field.key].trim();
      const featureMetadata = metadata?.features[field.key];
      if (!featureMetadata) {
        errors[field.key] = "Dataset ranges are still loading. Please try again.";
        continue;
      }
      const datasetOptions = featureMetadata.type === "categorical" && Array.isArray(featureMetadata.values)
        ? featureMetadata.values.map(String)
        : undefined;
      const datasetMin = featureMetadata.type === "numeric" ? featureMetadata.min : undefined;
      const datasetMax = featureMetadata.type === "numeric" ? featureMetadata.max : undefined;
      if (!value) {
        errors[field.key] = "This field is required.";
        continue;
      }
      if (datasetOptions && !datasetOptions.includes(value)) {
        errors[field.key] = "Select one of the available options.";
        continue;
      }
      if (!datasetOptions) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          errors[field.key] = "Enter a valid finite number.";
          continue;
        }
        if (datasetMin !== undefined && number < datasetMin) {
          errors[field.key] = `Enter a value of at least ${datasetMin}.`;
        } else if (datasetMax !== undefined && number > datasetMax) {
          errors[field.key] = `Enter a value no greater than ${datasetMax}.`;
        }
      }
    }
  }
  return errors;
}

function fieldId(key: FeatureKey) {
  return `prediction-${key}`;
}

type SelectOption = { value: string; label: string };

const categoricalLabels: Partial<Record<CategoricalField, Record<string, string>>> = {
  Gender: { "1": "Female", "2": "Male" },
  Family_History: { "1": "Yes, family history", "2": "No family history" },
  Diabetes_Status: { "1": "No diabetes", "2": "Type 1 diabetes", "3": "Type 2 diabetes" },
};

export function PredictionForm() {
  const { metrics } = useModelAnalysis();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode") === "csv" ? "csv" : "manual";
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [featureMetadata, setFeatureMetadata] = useState<FeatureMetadataResponse | null>(null);
  const [featureMetadataError, setFeatureMetadataError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CsvPredictionResponse | null>(null);
  const [csvSuccess, setCsvSuccess] = useState(false);
  const [telegramNotification, setTelegramNotification] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchFeatureMetadata()
      .then((metadata) => {
        if (!ignore) {
          setFeatureMetadata(metadata);
          setFeatureMetadataError(null);
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setFeatureMetadata(null);
          setFeatureMetadataError(error instanceof PredictionApiError && error.message.includes("connect")
            ? "Prediction backend unavailable. Start the FastAPI server at http://localhost:8001 and try again."
            : error instanceof PredictionApiError
              ? error.message
              : "Prediction backend unavailable. Start the FastAPI server at http://localhost:8001 and try again.");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const inputMode = requestedMode;

  const completedCount = useMemo(
    () => Object.values(values).filter((value) => value.trim() !== "").length,
    [values],
  );

  const allFields = sections.flatMap((section) => section.fields.map((field) => field.key));

  function chooseInputMode(mode: "manual" | "csv") {
    router.replace(mode === "csv" ? "/predict?mode=csv" : "/predict", { scroll: false });
  }

  function updateValue(key: FeatureKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setRequestError(null);
    setResult(null);
  }

  async function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const validationErrors = validate(values, featureMetadata);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setResult(null);
      return;
    }

    const payload = Object.fromEntries(
      [...numericalFields, ...categoricalFields].map((key) => [
        key,
        numericalFields.includes(key as NumericalField) || categoricalFields.includes(key as CategoricalField) ? Number(values[key]) : values[key],
      ]),
    ) as PatientData;
    setRequestError(null);
    setResult(null);
    setIsLoading(true);
    try {
      const response = await predictPatient(payload);
      const notificationError = await sendPredictionReport([{ label: response.predicted_label, count: 1 }]);
      try {
        window.sessionStorage.setItem(
          "cardio-prediction-telegram-status",
          notificationError ? `error:${notificationError}` : "sent",
        );
      } catch {
        console.error("Could not save the Telegram report delivery status.");
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("cardio-last-prediction", JSON.stringify(response));
      }
      setResult(response);
      router.push("/result");
    } catch (error) {
      setRequestError(
        error instanceof PredictionApiError
          ? error.message
          : "Something went wrong while requesting a prediction. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCsvUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (!csvFile) {
      setCsvError("Choose a CSV file containing exactly the 23 prediction features.");
      return;
    }
    setCsvError(null);
    setCsvResult(null);
    setCsvSuccess(false);
    setTelegramNotification(null);
    if (!featureMetadata) {
      setCsvError("Prediction backend unavailable. Start the FastAPI server at http://localhost:8001 and try again.");
      return;
    }
    setIsLoading(true);
    try {
      const validationErrors = await validatePredictionCsv(csvFile, featureMetadata);
      if (validationErrors.length) {
        setCsvError(validationErrors.join(" "));
        return;
      }
      const response = await predictCsv(csvFile);
      const labelCounts = new Map<string, number>();
      for (const result of response.results) {
        if (result.Prediction_Status.trim().toLowerCase() === "success") {
          labelCounts.set(result.Prediction_Label, (labelCounts.get(result.Prediction_Label) ?? 0) + 1);
        }
      }
      if (labelCounts.size > 0) {
        const notificationError = await sendPredictionReport(
          [...labelCounts].map(([label, count]) => ({ label, count })),
        );
        setTelegramNotification(
          notificationError
            ? `Prediction completed, but the Telegram report was not delivered: ${notificationError}`
            : "Prediction summary automatically sent to Telegram. No patient inputs were included.",
        );
      } else {
        setTelegramNotification("No successful predictions were available to include in the Telegram summary.");
      }
      setCsvResult(response);
      setCsvSuccess(true);
      setRequestError(null);
    } catch (error) {
      setCsvError(error instanceof PredictionApiError ? error.message : "The CSV prediction request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setValues(initialValues);
    setErrors({});
    setRequestError(null);
    setResult(null);
  }

  function handleFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, currentKey: FeatureKey) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const currentIndex = allFields.indexOf(currentKey);
    const nextField = allFields[currentIndex + 1];
    if (!nextField) {
      return;
    }

    const nextElement = document.getElementById(fieldId(nextField));
    if (nextElement instanceof HTMLElement) {
      nextElement.focus();
      nextElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <section className="prediction-form-section" id="prediction-form" aria-labelledby="form-title">
      <div className="prediction-shell">
        <div className="prediction-hero-grid">
          <div className="prediction-header-block">
            <p className="eyebrow"><span className="eyebrow__line" /> Prediction workspace</p>
            <h2 id="form-title">Patient Assessment</h2>
            <p className="form-intro__copy">Enter the required patient attributes to generate a multi-class model prediction.</p>
            <p className="prediction-telegram-notice">After a successful prediction, the predicted class and label are automatically sent to the configured project Telegram bot. No identity, confidence, or patient inputs are sent.</p>
            <div className="form-progress" aria-live="polite" aria-label={`${completedCount} of ${allFields.length} fields completed`}>
              <span>{String(completedCount).padStart(2, "0")} / {allFields.length}</span>
              <small>Attributes completed</small>
              <div className="form-progress__track"><span style={{ width: `${(completedCount / allFields.length) * 100}%` }} /></div>
            </div>
          </div>

          <aside className="prediction-visual-card" aria-label="Anatomical heart illustration">
            <div className="prediction-visual-card__frame">
              <Image src="/images/anatomical-heart.png" alt="Realistic anatomical human heart illustration" width={720} height={540} priority />
            </div>
          </aside>
        </div>

        <div className="prediction-model-card">
          <p className="prediction-card__eyebrow">AI Prediction Model</p>
          <div className="prediction-stat-grid">
            <div><span>Model</span><strong>1D CNN</strong></div>
            <div><span>Input</span><strong>23 clinical features</strong></div>
            <div><span>Status</span><strong>Final frozen model</strong></div>
            <div><span>Test Accuracy</span><strong>{formatModelPercent(metrics.testAccuracy)}</strong></div>
          </div>
        </div>

        <div className="prediction-mode-switch" role="tablist" aria-label="Prediction input mode">
          <button type="button" role="tab" aria-selected={inputMode === "manual"} className={inputMode === "manual" ? "active" : ""} onClick={() => chooseInputMode("manual")}>Manual Prediction</button>
          <button type="button" role="tab" aria-selected={inputMode === "csv"} className={inputMode === "csv" ? "active" : ""} onClick={() => chooseInputMode("csv")}>CSV Prediction</button>
        </div>

        {featureMetadata ? (
          <div className="prediction-backend-status prediction-backend-status--connected" role="status"><span aria-hidden="true" /> Backend connected</div>
        ) : featureMetadataError ? (
          <div className="prediction-backend-status prediction-backend-status--error" role="alert"><TriangleAlert size={17} /><div><strong>Prediction backend unavailable</strong><p>{featureMetadataError}</p></div></div>
        ) : null}

        {inputMode === "manual" ? (
          <form className="prediction-form" onSubmit={handleReview} noValidate>
            <div className="form-sections">
              {sections.map((section, sectionIndex) => (
                <motion.fieldset
                  className="form-card"
                  key={section.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.35, delay: sectionIndex * 0.04 }}
                >
                  <legend className="form-card__legend">
                    <span>{section.eyebrow}</span>
                    <strong><section.icon size={17} /> {section.title}</strong>
                  </legend>
                  <div className="field-grid">
                    {section.fields.map((field) => {
                      const id = fieldId(field.key);
                      const error = errors[field.key];
                      const metadata = featureMetadata?.features[field.key];
                      const min = metadata?.type === "numeric" ? metadata.min : undefined;
                      const max = metadata?.type === "numeric" ? metadata.max : undefined;
                      const options: SelectOption[] | undefined = metadata?.type === "categorical" && Array.isArray(metadata.values)
                        ? metadata.values.map((option) => {
                            const value = String(option);
                            return {
                              value,
                              label: categoricalLabels[field.key as CategoricalField]?.[value] ?? "Available option",
                            };
                          })
                        : undefined;
                      const rangeLabel = min !== undefined && max !== undefined
                        ? `${min.toLocaleString(undefined, { maximumFractionDigits: 2 })}–${max.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : null;
                      return (
                        <div className={`form-field ${error ? "form-field--error" : ""}`} key={field.key}>
                          <label htmlFor={id}>
                            <span>{field.label}</span>
                            {options ? <small>{field.unit ?? "Select"}</small> : rangeLabel ? <small>{rangeLabel}</small> : field.unit ? <small>{field.unit}</small> : null}
                          </label>
                          {options ? (
                            <div className="select-wrap">
                              <select id={id} value={values[field.key]} onChange={(event) => updateValue(field.key, event.target.value)} onKeyDown={(event) => handleFieldKeyDown(event, field.key)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
                                <option value="">Select a value</option>
                                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              <ChevronDown size={16} aria-hidden="true" />
                            </div>
                          ) : (
                            <input id={id} name={field.key} type="number" inputMode="decimal" autoComplete="off" value={values[field.key]} min={min} max={max} step={field.step} onChange={(event) => updateValue(field.key, event.target.value)} onKeyDown={(event) => handleFieldKeyDown(event, field.key)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
                          )}
                          <span className="field-key">{field.key}</span>
                          {error && <motion.span id={`${id}-error`} className="field-error" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}><TriangleAlert size={13} /> {error}</motion.span>}
                        </div>
                      );
                    })}
                  </div>
                </motion.fieldset>
              ))}
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={resetForm}><RotateCcw size={16} /> Reset Form</button>
              <motion.button type="submit" className="primary-button" disabled={isLoading} whileHover={{ y: isLoading ? 0 : -2 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                {isLoading ? <><LoaderCircle className="loading-spinner" size={16} /> Analyzing...</> : <><Send size={16} /> Analyze Prediction</>}
              </motion.button>
            </div>
          </form>
        ) : (
          <form className="prediction-form" onSubmit={handleCsvUpload} noValidate>
            <div className="form-card csv-upload-panel">
              <div className="csv-upload-header">
                <p className="eyebrow"><span className="eyebrow__line" /> Batch prediction</p>
                <h3>Upload a patient CSV</h3>
              </div>
              <label className="csv-upload-dropzone" htmlFor="csv-upload-input">
                <FileUp size={20} />
                <strong>Upload Patient CSV</strong>
                <span>Drag and drop your CSV here or <b>Choose File</b></span>
                <small>Required columns: 23 clinical features</small>
                <input className="csv-upload-input" id="csv-upload-input" type="file" accept=".csv,text/csv" onChange={(event) => { setCsvFile(event.target.files?.[0] ?? null); setCsvError(null); }} />
              </label>
              {csvFile && <div className="csv-file-selected"><span><strong>File selected:</strong> {csvFile.name}</span><button type="button" className="icon-button" onClick={() => { setCsvFile(null); setCsvError(null); }} aria-label="Remove selected CSV file">×</button></div>}
              <p className="csv-upload-help">Use exactly the 23 prediction feature columns. Diagnosis_Class and Diagnosis_Label are not required or accepted.</p>
              <p className="prediction-telegram-notice">After a successful batch, a count for each predicted label is automatically sent to the configured project Telegram bot. No patient inputs, identifiers, or confidence values are sent.</p>
              {featureMetadata && <p className="csv-upload-help">Values are checked against the backend&apos;s accepted categories and dataset ranges before upload.</p>}
              {csvError && <p className="field-error csv-error"><TriangleAlert size={13} /> {csvError}</p>}
              {csvSuccess && <p className="csv-success" role="status">Prediction completed successfully.</p>}
              <div className="form-actions csv-actions">
                <button type="button" className="secondary-button" onClick={() => { setCsvFile(null); setCsvError(null); setCsvResult(null); setCsvSuccess(false); }}><RotateCcw size={16} /> Clear</button>
                <motion.button type="submit" className="primary-button" disabled={isLoading || !csvFile || !featureMetadata} whileHover={{ y: isLoading ? 0 : -2 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                  {isLoading ? <><LoaderCircle className="loading-spinner" size={16} /> Running predictions...</> : <><Send size={16} /> Run Batch Prediction</>}
                </motion.button>
              </div>
            </div>
          </form>
        )}

        {csvResult && <CsvResultsPanel response={csvResult} telegramNotification={telegramNotification} onUploadAnother={() => { setCsvResult(null); setCsvFile(null); setCsvError(null); setCsvSuccess(false); setTelegramNotification(null); }} />}

        {requestError && (
          <motion.aside className="prediction-error" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <TriangleAlert size={18} />
            <div>
              <strong>Unable to complete the prediction request.</strong>
              <p>{requestError}</p>
            </div>
          </motion.aside>
        )}

        {result && <PredictionResult result={result} onNewPrediction={resetForm} />}
      </div>

      <div className="prediction-disclaimer">
        Research and educational use only. This machine-learning prediction is not a medical diagnosis and should not replace professional medical advice.
      </div>
    </section>
  );
}
