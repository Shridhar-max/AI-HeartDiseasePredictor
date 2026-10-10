import type { Metadata } from "next";
import { ModelAnalysisProvider } from "@/components/model-analysis-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CardioLens | Heart Disease Prediction",
  description: "A research interface for a CNN-based heart disease prediction system.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body><ModelAnalysisProvider>{children}</ModelAnalysisProvider></body></html>;
}
