export type PatientData = {
  Age: number;
  BMI: number;
  Resting_BP: number;
  Serum_Cholesterol: number;
  Fasting_Blood_Sugar: number;
  Max_Heart_Rate: number;
  ST_Depression_Oldpeak: number;
  Ejection_Fraction: number;
  Troponin_Level: number;
  BNP_Level: number;
  CRP_Level: number;
  WBC_Count: number;
  HRV_SDNN: number;
  Resting_Respiratory_Rate: number;
  SpO2: number;
  Triglycerides: number;
  LDL_Cholesterol: number;
  HDL_Cholesterol: number;
  Cigarettes_Per_Day: number;
  Alcohol_ml_Per_Day: number;
  Gender: 1 | 2;
  Family_History: 1 | 2;
  Diabetes_Status: 1 | 2 | 3;
};

export type PredictionResponse = {
  confidence: number;
  predicted_class: number;
  predicted_label: string;
  probabilities: Record<string, number>;
  affected_attributes?: Array<{
    feature: string;
    current_value: string | number;
    direction: string;
    impact_score: number;
    impact_level: "high" | "medium" | "low";
    predicted_class: number;
    predicted_label: string;
  }>;
  impact_graph?: {
    title: string;
    predicted_class: number;
    predicted_label: string;
    items: PredictionResponse["affected_attributes"];
  };
};

export type FeatureMetadata = {
  type: "numeric" | "categorical";
  min?: number;
  max?: number;
  values?: number[] | string[];
};

export type FeatureMetadataResponse = {
  feature_count: number;
  dataset_path: string;
  features: Record<string, FeatureMetadata>;
};

export type ModelAnalysis = {
  dataset_name: string;
  dataset_size: number;
  input_feature_count: number;
  num_classes: number;
  feature_names: string[];
  model_name: string;
  training_date: string;
  test_accuracy: number;
  validation_accuracy: number;
  test_loss: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  precision_weighted: number;
  recall_weighted: number;
  f1_weighted: number;
  classification_report: Record<string, Record<string, number> | number>;
  confusion_matrix: number[][];
  class_labels: Record<string, string>;
  class_distribution: Array<{ class_id: number; label: string; count: number; test_count: number; percentage: number }>;
  train_size: number;
  validation_size: number;
  test_size: number;
  training_epochs: number;
  best_validation_epoch: number;
  final_training_accuracy: number;
  final_training_loss: number;
  best_validation_loss: number;
  training_metadata: {
  training_date: string;
  epochs: number;
  best_validation_epoch: number;
  final_training_accuracy: number;
  final_training_loss: number;
  best_validation_loss: number;
  preprocessing_method: string;
  feature_selection_method: string;
  train_size: number;
  validation_size: number;
  test_size: number;
  };
  preprocessing_method: string;
  feature_selection_method: string;
  selected_features: string[];
  feature_importance: Array<{ feature: string; importance: number; importance_std: number; rank: number }>;
  mi_feature_ranking: Array<{ feature: string; score: number; rank: number }>;
  correlation_features: string[];
  correlation_matrix: number[][];
  precision_per_class: Array<{ class_id: number; label: string; precision: number }>;
};

export interface CsvPredictionResult {
  Age: number;
  Gender: number;
  BMI: number;
  Resting_BP: number;
  Serum_Cholesterol: number;
  Fasting_Blood_Sugar: number;
  Max_Heart_Rate: number;
  ST_Depression_Oldpeak: number;
  Ejection_Fraction: number;
  Troponin_Level: number;
  BNP_Level: number;
  CRP_Level: number;
  WBC_Count: number;
  HRV_SDNN: number;
  Resting_Respiratory_Rate: number;
  SpO2: number;
  Triglycerides: number;
  LDL_Cholesterol: number;
  HDL_Cholesterol: number;
  Cigarettes_Per_Day: number;
  Family_History: number;
  Diabetes_Status: number;
  Alcohol_ml_Per_Day: number;
  Prediction_Class: number;
  Prediction_Label: string;
  Prediction_Confidence: number;
  Prediction_Status: string;
}

export interface CsvPredictionResponse {
  filename: string;
  total_records: number;
  successful_predictions: number;
  failed_predictions: number;
  results: CsvPredictionResult[];
}

export interface HistoryRecord {
  id: string;
  owner_email?: string;
  uploaded_file_name: string;
  record_index: number;
  all_23_input_attributes: Record<string, string | number | null>;
  prediction_class: number;
  prediction_label: string;
  prediction_confidence: number;
  prediction_timestamp: string;
  model_name: string;
  prediction_type: "CSV" | "Single" | string;
}

export class PredictionApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PredictionApiError";
  }
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/+$/, "");

function getCurrentOwnerEmail(): string {
  if (typeof window === "undefined") {
    throw new PredictionApiError("Your user session is unavailable.", 401);
  }
  const profile = window.localStorage.getItem("cardio-profile");
  if (!profile) {
    throw new PredictionApiError("Your user session is unavailable.", 401);
  }
  try {
    const parsed = JSON.parse(profile) as { email?: unknown };
    if (typeof parsed.email !== "string" || !parsed.email.trim() || !parsed.email.includes("@")) {
      throw new PredictionApiError("Your user session is unavailable.", 401);
    }
    return parsed.email.trim().toLowerCase();
  } catch (error) {
    if (error instanceof PredictionApiError) {
      throw error;
    }
    throw new PredictionApiError("Your user session is unavailable.", 401);
  }
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
  timeoutMessage = "The backend request timed out. Please try again.",
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has("X-User-Email")) {
    headers.set("X-User-Email", getCurrentOwnerEmail());
  }
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    if (controller.signal.aborted) {
      throw new PredictionApiError(timeoutMessage);
    }
    throw new PredictionApiError("Unable to connect to the prediction backend. Check that the API is running.");
  } finally {
    clearTimeout(timeout);
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  if ("detail" in body && typeof body.detail === "string") {
    const errors = "errors" in body && Array.isArray(body.errors) ? body.errors : [];
    const fieldMessages = errors
      .filter((item): item is { field?: unknown; message?: unknown } => typeof item === "object" && item !== null)
      .map((item) => `${String(item.field ?? "field")}: ${String(item.message ?? "Invalid value")}`)
      .join("; ");
    return fieldMessages ? `${body.detail} ${fieldMessages}` : body.detail;
  }
  return null;
}

function isPredictionResponse(body: unknown): body is PredictionResponse {
  if (typeof body !== "object" || body === null) return false;
  if (!("confidence" in body) || !("predicted_class" in body) || !("predicted_label" in body) || !("probabilities" in body)) return false;
  const confidence = body.confidence;
  const predictedClass = body.predicted_class;
  const predictedLabel = body.predicted_label;
  const probabilities = body.probabilities;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return false;
  if (typeof predictedClass !== "number" || !Number.isInteger(predictedClass) || predictedClass < 0) return false;
  if (typeof predictedLabel !== "string" || predictedLabel.length === 0) return false;
  if (typeof probabilities !== "object" || probabilities === null) return false;
  const probabilityRecord = probabilities as Record<string, unknown>;
  const values = Object.values(probabilityRecord);
  return values.length > 1 && values.every((value) => typeof value === "number" && Number.isFinite(value));
}

export async function fetchFeatureMetadata(): Promise<FeatureMetadataResponse> {
  const response = await apiFetch("/feature-metadata", {}, 15_000, "Loading feature metadata timed out.");

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new PredictionApiError(extractErrorMessage(body) ?? "The feature metadata endpoint is unavailable.", response.status);
  }

  if (typeof body !== "object" || body === null || !("features" in body)) {
    throw new PredictionApiError("The prediction service returned invalid feature metadata.");
  }

  return body as FeatureMetadataResponse;
}

export async function fetchModelAnalysis(): Promise<ModelAnalysis> {
  const response = await apiFetch("/model-analysis", { cache: "no-store" }, 20_000, "Loading model metrics timed out.");
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new PredictionApiError(extractErrorMessage(body) ?? "Model analysis is unavailable.", response.status);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("model_name" in body) ||
    !("test_accuracy" in body) ||
    !("precision_macro" in body) ||
    !("recall_macro" in body) ||
    !("f1_macro" in body) ||
    !("f1_weighted" in body)
  ) {
    throw new PredictionApiError("The analysis service returned an invalid analysis payload.");
  }
  return body as ModelAnalysis;
}

export async function predictPatient(patientData: PatientData): Promise<PredictionResponse> {
  const response = await apiFetch(
    "/predict",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
    },
    60_000,
    "Prediction timed out. Please try again.",
  );

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new PredictionApiError(
        extractErrorMessage(body) ?? "The patient data was rejected by the prediction service.",
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new PredictionApiError(
        "The prediction service is temporarily unavailable. Please try again.",
        response.status,
      );
    }
    throw new PredictionApiError(
      extractErrorMessage(body) ?? "The prediction request could not be completed.",
      response.status,
    );
  }

  if (!isPredictionResponse(body)) {
    throw new PredictionApiError("The prediction service returned an invalid response.");
  }
  return body;
}

export async function predictCsv(csvFile: File): Promise<CsvPredictionResponse> {
  const formData = new FormData();
  formData.append("file", csvFile);

  const response = await apiFetch(
    "/predict-csv",
    {
      method: "POST",
      body: formData,
    },
    120_000,
    "CSV prediction timed out. Try a smaller file or retry later.",
  );

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw new PredictionApiError(
      extractErrorMessage(body) ?? "The CSV prediction request could not be completed.",
      response.status,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { filename?: unknown }).filename !== "string" ||
    !Array.isArray((body as { results?: unknown }).results)
  ) {
    throw new PredictionApiError("The prediction service returned an invalid CSV result.");
  }
  return body as CsvPredictionResponse;
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  const response = await apiFetch("/history", { cache: "no-store" }, 15_000, "Loading prediction history timed out.");
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PredictionApiError(extractErrorMessage(body) ?? "Prediction history is unavailable.", response.status);
  }
  if (typeof body !== "object" || body === null || !Array.isArray((body as { records?: unknown }).records)) {
    throw new PredictionApiError("The prediction history service returned an invalid response.");
  }
  return (body as { records: HistoryRecord[] }).records;
}

export async function deleteHistoryRecord(recordId: string): Promise<void> {
  const response = await apiFetch(`/history/${encodeURIComponent(recordId)}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PredictionApiError(extractErrorMessage(body) ?? "The history record could not be deleted.", response.status);
  }
}

export async function clearHistory(): Promise<void> {
  const response = await apiFetch("/history", { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PredictionApiError(extractErrorMessage(body) ?? "Prediction history could not be cleared.", response.status);
  }
}

export async function fetchHealth(): Promise<boolean> {
  const response = await apiFetch("/health", {}, 5_000, "The backend health check timed out.");
  const body = await response.json().catch(() => null) as { status?: unknown } | null;
  if (!response.ok || body?.status !== "healthy") {
    throw new PredictionApiError("The prediction backend is not reporting healthy status.", response.status);
  }
  return true;
}
