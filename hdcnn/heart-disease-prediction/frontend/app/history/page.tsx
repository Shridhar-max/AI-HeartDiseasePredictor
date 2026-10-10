"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eraser, History as HistoryIcon, LoaderCircle, Search, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clearHistory, deleteHistoryRecord, fetchHistory, PredictionApiError, type HistoryRecord } from "@/lib/api";

const inputColumns = [
  "Age", "Gender", "BMI", "Resting_BP", "Serum_Cholesterol", "Fasting_Blood_Sugar", "Max_Heart_Rate", "ST_Depression_Oldpeak", "Ejection_Fraction", "Troponin_Level", "BNP_Level", "CRP_Level", "WBC_Count", "HRV_SDNN", "Resting_Respiratory_Rate", "SpO2", "Triglycerides", "LDL_Cholesterol", "HDL_Cholesterol", "Cigarettes_Per_Day", "Family_History", "Diabetes_Status", "Alcohol_ml_Per_Day",
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatConfidence(value: number) {
  return `${Math.min(Math.max(value, 0), 100).toFixed(2)}%`;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch((requestError) => setError(requestError instanceof PredictionApiError ? requestError.message : "Unable to load prediction history."))
      .finally(() => setLoading(false));
  }, []);

  const labels = useMemo(() => [...new Set(history.map((record) => record.prediction_label))].sort(), [history]);
  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return history.filter((record) => {
      const matchesType = typeFilter === "all" || record.prediction_type === typeFilter;
      const matchesLabel = labelFilter === "all" || record.prediction_label === labelFilter;
      const matchesDate = !dateFilter || record.prediction_timestamp.startsWith(dateFilter);
      const searchable = `${record.id} ${record.uploaded_file_name} ${record.prediction_label} ${JSON.stringify(record.all_23_input_attributes)}`.toLowerCase();
      return matchesType && matchesLabel && matchesDate && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [dateFilter, history, labelFilter, query, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const averageConfidence = history.length ? history.reduce((sum, record) => sum + record.prediction_confidence, 0) / history.length : 0;

  async function removeRecord(record: HistoryRecord) {
    try {
      await deleteHistoryRecord(record.id);
      setHistory((current) => current.filter((item) => item.id !== record.id));
      setSelected(null);
    } catch (requestError) {
      setError(requestError instanceof PredictionApiError ? requestError.message : "Unable to delete this history record.");
    }
  }

  async function removeAll() {
    try {
      await clearHistory();
      setHistory([]);
      setConfirmClear(false);
    } catch (requestError) {
      setError(requestError instanceof PredictionApiError ? requestError.message : "Unable to clear prediction history.");
    }
  }

  function exportHistory() {
    const headers = [...inputColumns, "Prediction_Class", "Prediction_Label", "Prediction_Confidence", "Prediction_Status", "Prediction_Timestamp", "Prediction_Type"];
    const lines = [headers.map(escapeCsv).join(",")];
    for (const record of filteredHistory) {
      const values = inputColumns.map((column) => record.all_23_input_attributes[column]);
      lines.push([...values, record.prediction_class, record.prediction_label, record.prediction_confidence.toFixed(2), "Success", record.prediction_timestamp, record.prediction_type].map(escapeCsv).join(","));
    }
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prediction-history.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Prediction History" subtitle="Persistent records from manual and CSV predictions.">
      <section className="history-page">
        <div className="history-header">
          <div className="history-header__content"><p className="eyebrow"><span className="eyebrow__line" /> PREDICTION HISTORY</p><h2>Prediction History</h2><p className="history-header__description">Every successful prediction is retained in the backend database for review.</p></div>
          <Link href="/predict" className="primary-button">New Prediction</Link>
        </div>

        <div className="history-summary-grid">
          <div className="history-summary-card"><span>TOTAL RECORDS</span><strong>{history.length}</strong><small>Persistent prediction records</small></div>
          <div className="history-summary-card"><span>CSV PREDICTIONS</span><strong>{history.filter((record) => record.prediction_type === "CSV").length}</strong><small>Batch rows saved</small></div>
          <div className="history-summary-card"><span>AVERAGE CONFIDENCE</span><strong>{formatConfidence(averageConfidence)}</strong><small>Across saved records</small></div>
          <div className="history-summary-card"><span>VISIBLE RECORDS</span><strong>{filteredHistory.length}</strong><small>Current filters</small></div>
        </div>

        <section className="content-card history-panel">
          <div className="history-toolbar">
            <label className="history-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search file, label, or patient value" aria-label="Search history" /></label>
            <label className="history-filter"><span>Type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}><option value="all">All</option><option value="CSV">CSV Predictions</option><option value="Single">Single Predictions</option></select></label>
            <label className="history-filter"><span>Label</span><select value={labelFilter} onChange={(event) => { setLabelFilter(event.target.value); setPage(1); }}><option value="all">All labels</option>{labels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="history-filter"><span>Date</span><input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }} /></label>
            <button type="button" className="secondary-button" onClick={exportHistory} disabled={filteredHistory.length === 0}><Download size={14} /> Export CSV</button>
            <button type="button" className="secondary-button secondary-button--ghost" onClick={() => setConfirmClear(true)} disabled={history.length === 0}><Eraser size={14} /> Clear History</button>
          </div>

          {error && <div className="prediction-error" role="alert"><strong>{error}</strong></div>}
          {loading ? <div className="history-empty-state"><LoaderCircle className="loading-spinner" size={22} /><strong>Loading persistent history...</strong></div> : history.length === 0 ? <div className="history-empty-state"><div className="history-empty-state__icon"><HistoryIcon size={22} /></div><div><strong>No predictions yet</strong><p>Completed manual and CSV predictions will appear here.</p></div><Link href="/predict" className="primary-button">Create New Prediction</Link></div> : filteredHistory.length === 0 ? <div className="history-empty-inline">No records match the current filters.</div> : <HistoryTable records={visibleHistory} currentPage={currentPage} totalPages={totalPages} totalMatches={filteredHistory.length} onPageChange={setPage} onSelect={setSelected} onDelete={removeRecord} />}
        </section>
      </section>

      {selected && <HistoryDetails record={selected} onClose={() => setSelected(null)} onDelete={() => removeRecord(selected)} />}
      {confirmClear && <div className="history-modal-backdrop" onClick={() => setConfirmClear(false)}><div className="history-confirm" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><h3>Clear all prediction history?</h3><p>This permanently removes the saved records from the backend database.</p><div className="history-confirm__actions"><button type="button" className="secondary-button secondary-button--ghost" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="primary-button primary-button--danger" onClick={removeAll}>Clear History</button></div></div></div>}
    </AppShell>
  );
}

function HistoryTable({ records, currentPage, totalPages, totalMatches, onPageChange, onSelect, onDelete }: { records: HistoryRecord[]; currentPage: number; totalPages: number; totalMatches: number; onPageChange: (page: number) => void; onSelect: (record: HistoryRecord) => void; onDelete: (record: HistoryRecord) => void }) {
  return <><div className="history-table-wrap history-table-wrap--desktop"><table className="history-table"><thead><tr><th>Date &amp; Time</th><th>File Name</th><th>Record</th><th>Prediction Label</th><th>Confidence</th><th>Type</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDate(record.prediction_timestamp)}</td><td>{record.uploaded_file_name}</td><td>#{record.record_index}</td><td><span className="prediction-label-badge">{record.prediction_label}</span></td><td><span className="confidence-badge">{formatConfidence(record.prediction_confidence)}</span></td><td>{record.prediction_type}</td><td><button type="button" className="history-view-button" onClick={() => onSelect(record)}>View Details</button><button type="button" className="icon-button" onClick={() => onDelete(record)} aria-label={`Delete record ${record.record_index}`}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div><div className="csv-results-pagination"><span>Showing {records.length} of {totalMatches} records</span><div><button type="button" className="secondary-button secondary-button--ghost" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" className="secondary-button secondary-button--ghost" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button></div></div></>;
}

function HistoryDetails({ record, onClose, onDelete }: { record: HistoryRecord; onClose: () => void; onDelete: () => void }) {
  return <div className="history-modal-backdrop" onClick={onClose}><div className="history-modal csv-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="history-modal__header"><div><p className="eyebrow"><span className="eyebrow__line" /> History details</p><h3>{record.uploaded_file_name} · #{record.record_index}</h3></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close details"><X size={16} /></button></div><div className="csv-detail-section"><h4>Patient Attributes</h4><div className="csv-detail-grid">{inputColumns.map((column) => <div key={column}><span>{column.replaceAll("_", " ")}</span><strong>{String(record.all_23_input_attributes[column] ?? "Not submitted")}</strong></div>)}</div></div><div className="csv-detail-section"><h4>Prediction Result</h4><div className="csv-detail-grid"><div><span>Predicted class</span><strong>{record.prediction_class}</strong></div><div><span>Predicted label</span><strong>{record.prediction_label}</strong></div><div><span>Confidence</span><strong>{formatConfidence(record.prediction_confidence)}</strong></div><div><span>Prediction timestamp</span><strong>{formatDate(record.prediction_timestamp)}</strong></div><div><span>Model name</span><strong>{record.model_name}</strong></div><div><span>Prediction type</span><strong>{record.prediction_type}</strong></div></div><p className="csv-clinical-disclaimer">Research and educational use only. This machine-learning prediction is not a medical diagnosis and should not replace professional medical advice.</p></div><div className="form-actions"><button type="button" className="secondary-button secondary-button--ghost" onClick={onDelete}><Trash2 size={14} /> Delete Record</button></div></div></div>;
}
