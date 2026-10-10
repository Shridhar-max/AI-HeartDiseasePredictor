type PredictionLabelCount = {
  label: string;
  count: number;
};

export async function sendPredictionReport(labels: PredictionLabelCount[]): Promise<string | null> {
  try {
    const response = await fetch("/api/prediction-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "prediction-summary", labels }),
      cache: "no-store",
    });

    if (response.ok) return null;

    const result: unknown = await response.json().catch(() => null);
    if (
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
    ) {
      return result.error;
    }
    return "Telegram did not accept the prediction report.";
  } catch {
    return "Telegram could not be reached. The prediction report was not delivered.";
  }
}
