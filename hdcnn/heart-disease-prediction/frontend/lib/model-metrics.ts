export const modelMetrics = {
  modelName: "1D CNN",
  inputFeatureCount: 23,
  classCount: 7,
} as const;

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
