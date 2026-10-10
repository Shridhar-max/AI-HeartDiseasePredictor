"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchModelAnalysis, type ModelAnalysis } from "@/lib/api";
import { modelMetrics } from "@/lib/model-metrics";

export type LiveModelMetrics = {
  modelName: string;
  testAccuracy: number | null;
  macroPrecision: number | null;
  macroRecall: number | null;
  macroF1: number | null;
  weightedF1: number | null;
};

type ModelAnalysisContextValue = {
  analysis: ModelAnalysis | null;
  error: string | null;
  isLoading: boolean;
  metrics: LiveModelMetrics;
  refresh: () => Promise<void>;
};

const initialMetrics: LiveModelMetrics = {
  modelName: modelMetrics.modelName,
  testAccuracy: null,
  macroPrecision: null,
  macroRecall: null,
  macroF1: null,
  weightedF1: null,
};

const ModelAnalysisContext = createContext<ModelAnalysisContextValue | null>(null);

export function ModelAnalysisProvider({ children }: { children: ReactNode }) {
  const [analysis, setAnalysis] = useState<ModelAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnalysis(await fetchModelAnalysis());
    } catch (reason) {
      setAnalysis(null);
      setError(reason instanceof Error ? reason.message : "Model analysis is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const metrics: LiveModelMetrics = analysis ? {
    modelName: modelMetrics.modelName,
    testAccuracy: analysis.test_accuracy * 100,
    macroPrecision: analysis.precision_macro * 100,
    macroRecall: analysis.recall_macro * 100,
    macroF1: analysis.f1_macro * 100,
    weightedF1: analysis.f1_weighted * 100,
  } : initialMetrics;

  return (
    <ModelAnalysisContext.Provider value={{ analysis, error, isLoading, metrics, refresh }}>
      {children}
    </ModelAnalysisContext.Provider>
  );
}

export function useModelAnalysis() {
  const context = useContext(ModelAnalysisContext);
  if (!context) {
    throw new Error("useModelAnalysis must be used inside ModelAnalysisProvider.");
  }
  return context;
}

export function formatModelPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}