"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Search, Upload, X } from "lucide-react";
import type { CsvPredictionResponse, CsvPredictionResult } from "@/lib/api";

const inputColumns = [
  "Age", "Gender", "BMI", "Resting_BP", "Serum_Cholesterol", "Fasting_Blood_Sugar",
  "Max_Heart_Rate", "ST_Depression_Oldpeak", "Ejection_Fraction", "Troponin_Level",
  "BNP_Level", "CRP_Level", "WBC_Count", "HRV_SDNN", "Resting_Respiratory_Rate",
  "SpO2", "Triglycerides", "LDL_Cholesterol", "HDL_Cholesterol", "Cigarettes_Per_Day",
  "Family_History", "Diabetes_Status", "Alcohol_ml_Per_Day",
] as const satisfies readonly (keyof CsvPredictionResult)[];

const predictionColumns = [
  "Prediction_Class", "Prediction_Label", "Prediction_Confidence", "Prediction_Status",
] as const satisfies readonly (keyof CsvPredictionResult)[];

type SortMode = "record" | "confidence-high" | "confidence-low" | "class";
type NumberedResult = { recordNumber: number; result: CsvPredictionResult };

const tableColumns: Array<{ key: keyof CsvPredictionResult; label: string }> = [
  { key: "Age", label: "Age" },
  { key: "Gender", label: "Gender" },
  { key: "BMI", label: "BMI" },
  { key: "Resting_BP", label: "Resting BP" },
  { key: "Serum_Cholesterol", label: "Serum Cholesterol" },
  { key: "Max_Heart_Rate", label: "Max Heart Rate" },
  { key: "Troponin_Level", label: "Troponin" },
  { key: "BNP_Level", label: "BNP" },
  { key: "CRP_Level", label: "CRP" },
  { key: "SpO2", label: "SpO2" },
  { key: "Prediction_Class", label: "Prediction Class" },
  { key: "Prediction_Label", label: "Prediction Label" },
  { key: "Prediction_Confidence", label: "Confidence" },
  { key: "Prediction_Status", label: "Status" },
];

function displayLabel(value: string) {
  return value.replaceAll("_", " ");
}

function confidencePercent(value: number) {
  return `${Math.min(Math.max(value, 0), 100).toFixed(2)}%`;
}

function formatInputValue(key: keyof CsvPredictionResult, value: string | number) {
  if (key === "Gender") return value === 1 ? "Female" : "Male";
  if (key === "Family_History") return value === 1 ? "Yes" : "No";
  if (key === "Diabetes_Status") return ({ 1: "None", 2: "Type 1", 3: "Type 2" } as Record<number, string>)[Number(value)] ?? String(value);
  return String(value);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function CsvResultsPanel({ response, onUploadAnother, telegramNotification }: { response: CsvPredictionResponse; onUploadAnother: () => void; telegramNotification?: string | null }) {
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("record");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<NumberedResult | null>(null);
  const pageSize = 8;

  const labels = useMemo(
    () => [...new Set(response.results.map((result) => result.Prediction_Label))].sort(),
    [response.results],
  );

  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const results = response.results.map((result, index) => ({ result, recordNumber: index + 1 })).filter(({ result, recordNumber }) => {
      const matchesLabel = labelFilter === "all" || result.Prediction_Label === labelFilter;
      const matchesStatus = statusFilter === "all" || result.Prediction_Status.toLowerCase() === statusFilter;
      const matchesQuery = !normalizedQuery || `${recordNumber} ${JSON.stringify(result)}`.toLowerCase().includes(normalizedQuery);
      return matchesLabel && matchesStatus && matchesQuery;
    });
    if (sortMode === "confidence-high") results.sort((left, right) => right.result.Prediction_Confidence - left.result.Prediction_Confidence);
    if (sortMode === "confidence-low") results.sort((left, right) => left.result.Prediction_Confidence - right.result.Prediction_Confidence);
    if (sortMode === "class") results.sort((left, right) => left.result.Prediction_Class - right.result.Prediction_Class);
    if (sortMode === "record") results.sort((left, right) => left.recordNumber - right.recordNumber);
    return results;
  }, [labelFilter, query, response.results, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function downloadResults() {
    const headers = [...inputColumns, ...predictionColumns];
    const lines = [headers.map(escapeCsv).join(",")];
    for (const result of response.results) {
      lines.push(headers.map((column) => escapeCsv(column === "Prediction_Confidence" ? result[column].toFixed(2) : result[column])).join(","));
    }
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.filename.replace(/\.csv$/i, "") + "-predictions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <section className="csv-results-page" aria-labelledby="csv-results-title">
      <div className="csv-results-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow__line" /> Batch results</p>
          <h3 id="csv-results-title">CSV Prediction Results</h3>
          <p>Every uploaded row was validated against the 23-feature model and saved to history.</p>
          {telegramNotification ? <p className="csv-upload-help" role={telegramNotification.startsWith("Prediction completed, but") ? "alert" : "status"}>{telegramNotification}</p> : null}
        </div>
        <span className="history-saved-badge">Saved to History</span>
      </div>

      <div className="csv-results-actions">
        <button type="button" className="secondary-button" onClick={onUploadAnother}><Upload size={16} /> Upload Another CSV</button>
        <Link href="/history" className="secondary-button"><Eye size={16} /> View History</Link>
        <button type="button" className="primary-button" onClick={downloadResults}><Download size={16} /> Download Results CSV</button>
      </div>

      <div className="csv-results-summary-grid">
        <div className="csv-results-summary-card"><span>Uploaded File Name</span><strong title={response.filename}>{response.filename}</strong></div>
        <div className="csv-results-summary-card"><span>Total Records</span><strong>{response.total_records}</strong></div>
        <div className="csv-results-summary-card"><span>Attributes</span><strong>{inputColumns.length}</strong></div>
        <div className="csv-results-summary-card"><span>Successful Predictions</span><strong>{response.successful_predictions}</strong></div>
        <div className="csv-results-summary-card"><span>Failed Predictions</span><strong>{response.failed_predictions}</strong></div>
        <div className="csv-results-summary-card"><span>Average Confidence</span><strong>{confidencePercent(response.results.reduce((sum, result) => sum + result.Prediction_Confidence, 0) / Math.max(response.results.length, 1))}</strong></div>
      </div>

      <div className="csv-results-toolbar">
        <label className="history-search"><Search size={14} /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search patient row or label" aria-label="Search CSV predictions" /></label>
        <label className="history-filter"><span>Prediction label</span><select value={labelFilter} onChange={(event) => { setLabelFilter(event.target.value); setPage(1); }}><option value="all">All labels</option>{labels.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
        <label className="history-filter"><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="success">Success</option></select></label>
        <label className="history-filter"><span>Sort by</span><select value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setPage(1); }}><option value="record">Record number</option><option value="confidence-high">Confidence: highest</option><option value="confidence-low">Confidence: lowest</option><option value="class">Prediction class</option></select></label>
      </div>

      <div className="csv-results-table-wrap">
        <table className="csv-results-table">
          <thead><tr><th>Record</th>{tableColumns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Details</th></tr></thead>
          <tbody>
            {visibleResults.map(({ result, recordNumber }) => (
              <tr key={`${response.filename}-${recordNumber}`}>
                <td>#{recordNumber}</td>
                {tableColumns.map(({ key }) => (
                  <td key={key}>
                    {key === "Prediction_Label" ? <span className="prediction-label-badge">{result[key]}</span>
                      : key === "Prediction_Confidence" ? <span className="confidence-badge">{confidencePercent(result[key])}</span>
                        : key === "Prediction_Status" ? <span className="prediction-status-badge">{result[key]}</span>
                          : formatInputValue(key, result[key])}
                  </td>
                ))}
                <td><button type="button" className="history-view-button" onClick={() => setSelectedRow({ result, recordNumber })}>View Details</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleResults.length === 0 && <div className="history-empty-inline">No rows match the current search or filter.</div>}
      <div className="csv-results-pagination"><span>Showing {visibleResults.length} of {filteredResults.length} matching records</span><div><button type="button" className="secondary-button secondary-button--ghost" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" className="secondary-button secondary-button--ghost" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>

      {selectedRow && (
        <div className="history-modal-backdrop" onClick={() => setSelectedRow(null)}>
          <div className="csv-detail-modal history-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header"><div><p className="eyebrow"><span className="eyebrow__line" /> Record #{selectedRow.recordNumber}</p><h3>CSV prediction details</h3></div><button type="button" className="icon-button" onClick={() => setSelectedRow(null)} aria-label="Close row details"><X size={16} /></button></div>
            <div className="csv-detail-section"><h4>All 23 input attributes</h4><div className="csv-detail-grid">{inputColumns.map((column) => <div key={column}><span>{displayLabel(column)}</span><strong>{formatInputValue(column, selectedRow.result[column])}</strong></div>)}</div></div>
            <div className="csv-detail-section"><h4>Prediction Result</h4><div className="csv-detail-grid"><div><span>Predicted class</span><strong>{selectedRow.result.Prediction_Class}</strong></div><div><span>Predicted label</span><strong>{selectedRow.result.Prediction_Label}</strong></div><div><span>Confidence</span><strong>{confidencePercent(selectedRow.result.Prediction_Confidence)}</strong></div><div><span>Prediction status</span><strong>{selectedRow.result.Prediction_Status}</strong></div><div><span>Model name</span><strong>1D CNN</strong></div></div><p className="csv-clinical-disclaimer">This system is a research/decision-support prototype and is not a medical diagnosis. Consult a qualified healthcare professional for clinical decisions.</p></div>
          </div>
        </div>
      )}
    </section>
  );
}
