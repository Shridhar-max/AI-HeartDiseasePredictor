import Papa from "papaparse";
import type { FeatureMetadataResponse, PatientData } from "@/lib/api";

export const csvFeatureColumns = [
  "Age",
  "Gender",
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
  "Family_History",
  "Diabetes_Status",
  "Alcohol_ml_Per_Day",
] as const satisfies readonly (keyof PatientData)[];

const categoricalColumns = new Set<string>(["Gender", "Family_History", "Diabetes_Status"]);

export async function validatePredictionCsv(
  file: File,
  metadata: FeatureMetadataResponse | null,
): Promise<string[]> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return ["Choose a .csv file."];
  }
  if (file.size === 0) {
    return ["The selected CSV is empty."];
  }
  if (!metadata) {
    return ["Feature metadata is unavailable. Reconnect to the backend before validating this CSV."];
  }

  let parsed: Papa.ParseResult<string[]>;
  try {
    const content = (await file.text()).replace(/^\uFEFF/, "");
    if (!content.trim()) {
      return ["The selected CSV contains no data."];
    }
    parsed = Papa.parse<string[]>(content, { skipEmptyLines: "greedy" });
  } catch {
    return ["The selected CSV could not be read. Try exporting it again as UTF-8 CSV."];
  }

  const malformed = parsed.errors.find((error) => error.type === "Quotes" || error.type === "Delimiter");
  if (malformed) {
    return [`CSV formatting error near row ${(malformed.row ?? 0) + 1}: ${malformed.message}`];
  }

  const [rawHeaders, ...rows] = parsed.data;
  if (!rawHeaders?.length) {
    return ["The CSV is missing its header row."];
  }
  const headers = rawHeaders.map((header) => header.trim());
  if (rawHeaders.some((header, index) => header !== headers[index])) {
    return ["Column names must match the required feature names exactly; surrounding spaces are not allowed."];
  }
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) {
    return [`Duplicate column(s): ${[...new Set(duplicates)].join(", ")}.`];
  }

  const required = new Set<string>(csvFeatureColumns);
  const missing = csvFeatureColumns.filter((column) => !headers.includes(column));
  const unexpected = headers.filter((header) => !required.has(header));
  const schemaErrors = [
    ...(missing.length ? [`Missing required column(s): ${missing.join(", ")}.`] : []),
    ...(unexpected.length ? [`Unexpected column(s): ${unexpected.join(", ")}. Include only the 23 prediction features; diagnosis targets are not accepted.`] : []),
  ];
  if (schemaErrors.length) {
    return schemaErrors;
  }
  if (rows.length === 0) {
    return ["The CSV has headers but no patient rows."];
  }

  const columnIndexes = new Map(headers.map((header, index) => [header, index]));
  for (const [rowIndex, row] of rows.entries()) {
    const displayRow = rowIndex + 2;
    if (row.length !== headers.length) {
      return [`Row ${displayRow} has ${row.length} values; expected ${headers.length}. Check for missing or extra separators.`];
    }
    for (const feature of csvFeatureColumns) {
      const value = row[columnIndexes.get(feature)!]?.trim() ?? "";
      if (!value) {
        return [`Row ${displayRow}: ${feature} is empty.`];
      }
      const featureMetadata = metadata.features[feature];
      if (!featureMetadata) {
        return [`Backend metadata is missing ${feature}; the CSV cannot be safely validated.`];
      }
      if (categoricalColumns.has(feature)) {
        const numericCategory = Number(value);
        const normalized = Number.isInteger(numericCategory) ? String(numericCategory) : value;
        const allowed = Array.isArray(featureMetadata.values) ? featureMetadata.values.map(String) : [];
        if (!allowed.includes(normalized)) {
          return [`Row ${displayRow}: ${feature} must be one of ${allowed.join(", ")}.`];
        }
        continue;
      }

      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return [`Row ${displayRow}: ${feature} must be a finite number.`];
      }
      if (featureMetadata.min !== undefined && numericValue < featureMetadata.min) {
        return [`Row ${displayRow}: ${feature} must be at least ${featureMetadata.min}.`];
      }
      if (featureMetadata.max !== undefined && numericValue > featureMetadata.max) {
        return [`Row ${displayRow}: ${feature} must be no greater than ${featureMetadata.max}.`];
      }
    }
  }

  return [];
}
