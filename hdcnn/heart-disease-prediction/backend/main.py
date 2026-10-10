"""FastAPI backend for single-patient heart disease prediction."""

import sys
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
	sys.path.insert(0, str(PROJECT_ROOT))

from backend.history import clear_prediction_records, delete_prediction_record, list_prediction_records, save_prediction_records
from ml.predict import load_feature_metadata, predict_csv_records, predict_patient

MODEL_ANALYSIS_PATH = PROJECT_ROOT / "ml" / "outputs" / "model_analysis.json"
MI_SCORES_PATH = PROJECT_ROOT / "ml" / "outputs" / "mutual_information_scores.csv"
CORRELATION_MATRIX_PATH = PROJECT_ROOT / "ml" / "outputs" / "correlation_matrix.csv"
PER_CLASS_METRICS_PATH = PROJECT_ROOT / "ml" / "outputs" / "per_class_metrics.csv"


def load_visual_analysis_artifacts(analysis: dict) -> dict:
	"""Load the four current visual-analysis datasets from generated outputs."""
	missing = [path.name for path in (MI_SCORES_PATH, CORRELATION_MATRIX_PATH, PER_CLASS_METRICS_PATH) if not path.is_file()]
	if missing:
		raise HTTPException(status_code=503, detail=f"Model analysis artifacts are missing: {', '.join(missing)}.")
	try:
		mi_frame = pd.read_csv(MI_SCORES_PATH)
		correlation_frame = pd.read_csv(CORRELATION_MATRIX_PATH, index_col=0)
		precision_frame = pd.read_csv(PER_CLASS_METRICS_PATH)
	except (OSError, pd.errors.ParserError, ValueError) as error:
		raise HTTPException(status_code=500, detail=f"Model analysis artifacts could not be loaded: {error}") from error
	if not {"Feature", "MI_Score", "Rank"}.issubset(mi_frame.columns):
		raise HTTPException(status_code=500, detail="Mutual-information artifact has an invalid schema.")
	raw_features = analysis.get("feature_names", [])
	mi_rows = []
	for rank, feature in enumerate(raw_features, start=1):
		feature_names = mi_frame["Feature"].astype(str)
		components = mi_frame[feature_names.str.endswith(f"__{feature}") | feature_names.str.contains(f"__{feature}_")]
		if components.empty:
			components = mi_frame[mi_frame["Feature"].astype(str).eq(feature)]
		if components.empty:
			continue
		best = components.loc[components["MI_Score"].astype(float).idxmax()]
		mi_rows.append({"feature": feature, "score": float(best["MI_Score"]), "rank": rank})
	mi_rows.sort(key=lambda item: item["score"], reverse=True)
	for rank, item in enumerate(mi_rows, start=1):
		item["rank"] = rank
	if len(mi_rows) != len(raw_features) or correlation_frame.shape != (len(raw_features), len(raw_features)):
		raise HTTPException(status_code=500, detail="Visual-analysis artifacts do not match the current 23-feature model.")
	if not {"Class", "Precision"}.issubset(precision_frame.columns):
		raise HTTPException(status_code=500, detail="Per-class metrics artifact has an invalid schema.")
	labels = analysis["class_labels"]
	precision_rows = [
		{"class_id": int(row["Class"]), "label": labels[str(int(row["Class"]))], "precision": float(row["Precision"])}
		for _, row in precision_frame.iterrows()
	]
	return {
		"mi_feature_ranking": mi_rows,
		"correlation_features": correlation_frame.columns.astype(str).tolist(),
		"correlation_matrix": correlation_frame.astype(float).values.tolist(),
		"precision_per_class": precision_rows,
	}


app = FastAPI(
	title="Heart Disease Prediction API",
	description="Predict a heart disease class from 23 clinical patient features.",
	version="1.0.0",
)
app.add_middleware(
	CORSMiddleware,
	allow_origins=[
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3010",
		"http://127.0.0.1:3010",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
	request: Request,
	error: RequestValidationError,
) -> JSONResponse:
	"""Return HTTP 400 for invalid prediction request payloads."""
	# Keep only JSON-safe fields so Pydantic context values cannot produce an
	# empty response while FastAPI is serializing the validation error.
	safe_errors = [
		{
			"field": ".".join(str(part) for part in item.get("loc", [])),
			"message": str(item.get("msg", "Invalid value")),
			"type": str(item.get("type", "value_error")),
		}
		for item in error.errors()
	]
	return JSONResponse(
		status_code=400,
		content={"detail": "Invalid prediction request.", "errors": safe_errors},
	)


class PatientPredictionRequest(BaseModel):
	"""The exact 23 clinical features accepted by the 13k model pipeline."""

	model_config = ConfigDict(extra="forbid")

	Age: float = Field(allow_inf_nan=False)
	BMI: float = Field(allow_inf_nan=False)
	Resting_BP: float = Field(allow_inf_nan=False)
	Serum_Cholesterol: float = Field(allow_inf_nan=False)
	Fasting_Blood_Sugar: float = Field(allow_inf_nan=False)
	Max_Heart_Rate: float = Field(allow_inf_nan=False)
	ST_Depression_Oldpeak: float = Field(allow_inf_nan=False)
	Ejection_Fraction: float = Field(allow_inf_nan=False)
	Troponin_Level: float = Field(allow_inf_nan=False)
	BNP_Level: float = Field(allow_inf_nan=False)
	CRP_Level: float = Field(allow_inf_nan=False)
	WBC_Count: float = Field(allow_inf_nan=False)
	HRV_SDNN: float = Field(allow_inf_nan=False)
	Resting_Respiratory_Rate: float = Field(allow_inf_nan=False)
	SpO2: float = Field(allow_inf_nan=False)
	Triglycerides: float = Field(allow_inf_nan=False)
	LDL_Cholesterol: float = Field(allow_inf_nan=False)
	HDL_Cholesterol: float = Field(allow_inf_nan=False)
	Cigarettes_Per_Day: float = Field(allow_inf_nan=False)
	Alcohol_ml_Per_Day: float = Field(allow_inf_nan=False)
	Gender: Literal[1, 2]
	Family_History: Literal[1, 2]
	Diabetes_Status: Literal[1, 2, 3]


@app.get("/", summary="API status", description="Return the running status of the API.")
def root() -> dict[str, str]:
	return {"status": "running", "service": "Heart Disease Prediction API"}


@app.get("/health", summary="Health check", description="Confirm that the API process is healthy.")
def health() -> dict[str, str]:
	return {"status": "healthy"}


def require_owner(owner_email: str | None = Header(default=None, alias="X-User-Email")) -> str:
	if owner_email is None or not owner_email.strip() or "@" not in owner_email:
		raise HTTPException(status_code=401, detail="A valid owner email is required.")
	return owner_email.strip().lower()


@app.get(
	"/feature-metadata",
	summary="Dataset-derived feature metadata",
	description="Return accepted feature names, numeric ranges, and categorical values computed from the source CSV.",
)
def feature_metadata() -> dict:
	try:
		return load_feature_metadata()
	except (FileNotFoundError, RuntimeError, ValueError) as error:
		raise HTTPException(status_code=500, detail=f"Unable to load feature metadata: {error}") from error


@app.get(
	"/model-analysis",
	summary="Latest trained model analysis",
	description="Return metrics and evaluation artifacts generated from the latest saved CNN and 13k dataset.",
)
def model_analysis() -> dict:
	"""Return only the latest generated analysis artifact, never stale fallback values."""
	if not MODEL_ANALYSIS_PATH.is_file():
		raise HTTPException(status_code=503, detail="Model analysis is unavailable. Run the evaluation pipeline first.")
	try:
		analysis = json.loads(MODEL_ANALYSIS_PATH.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError) as error:
		raise HTTPException(status_code=500, detail=f"Model analysis could not be loaded: {error}") from error
	if not isinstance(analysis, dict):
		raise HTTPException(status_code=500, detail="Model analysis has an invalid root structure.")
	required_fields = (
		"dataset_name",
		"dataset_size",
		"input_feature_count",
		"class_labels",
		"test_accuracy",
		"validation_accuracy",
		"confusion_matrix",
		"feature_importance",
		"class_distribution",
	)
	missing_fields = [field for field in required_fields if field not in analysis]
	if missing_fields:
		raise HTTPException(
			status_code=500,
			detail=f"Model analysis is missing required field(s): {', '.join(missing_fields)}.",
		)
	class_labels = analysis["class_labels"]
	matrix = analysis["confusion_matrix"]
	if not isinstance(class_labels, dict) or not class_labels:
		raise HTTPException(status_code=500, detail="Model analysis has no class-label mapping.")
	class_count = len(class_labels)
	if (
		not isinstance(matrix, list)
		or len(matrix) != class_count
		or any(not isinstance(row, list) or len(row) != class_count for row in matrix)
	):
		raise HTTPException(status_code=500, detail="Model analysis confusion matrix does not match the class mapping.")
	for metric in ("test_accuracy", "validation_accuracy"):
		if not isinstance(analysis[metric], (int, float)) or not math.isfinite(analysis[metric]):
			raise HTTPException(status_code=500, detail=f"Model analysis metric '{metric}' is invalid.")
	analysis["num_classes"] = class_count
	analysis["training_metadata"] = {
		"training_date": analysis.get("training_date"),
		"epochs": analysis.get("training_epochs"),
		"best_validation_epoch": analysis.get("best_validation_epoch"),
		"final_training_accuracy": analysis.get("final_training_accuracy"),
		"final_training_loss": analysis.get("final_training_loss"),
		"best_validation_loss": analysis.get("best_validation_loss"),
		"preprocessing_method": analysis.get("preprocessing_method"),
		"feature_selection_method": analysis.get("feature_selection_method"),
		"train_size": analysis.get("train_size"),
		"validation_size": analysis.get("validation_size"),
		"test_size": analysis.get("test_size"),
	}
	analysis.update(load_visual_analysis_artifacts(analysis))
	return analysis


@app.post(
	"/predict",
	 summary="Predict heart disease class",
	 description="Validate 23 clinical features and return the multi-class CNN prediction.",
)
def predict(
	request: PatientPredictionRequest,
	owner_email: str = Depends(require_owner),
) -> dict:
	try:
		result = predict_patient(request.model_dump())
		save_prediction_records(
			"Manual entry",
			[
				{
					**request.model_dump(),
					"Prediction_Class": result["predicted_class"],
					"Prediction_Label": result["predicted_label"],
					"Prediction_Confidence": float(result["confidence"]) * 100,
					"Prediction_Status": "Success",
				}
			],
			"1D CNN",
			"Single",
			datetime.now(timezone.utc).isoformat(),
			owner_email,
		)
		return result
	except (ValueError, TypeError) as error:
		raise HTTPException(status_code=400, detail=f"Invalid prediction input: {error}") from error
	except (FileNotFoundError, RuntimeError) as error:
		raise HTTPException(
			status_code=500,
			detail="Prediction service artifacts are unavailable.",
		) from error
	except Exception as error:
		raise HTTPException(
			status_code=500,
			detail="An internal prediction error occurred.",
		) from error


@app.post(
	"/predict-csv",
	summary="Predict on a CSV file of patient rows",
	description="Validate a CSV file, return one result per row, and save successful predictions to history.",
)
async def predict_csv(
	file: UploadFile = File(...),
	owner_email: str = Depends(require_owner),
) -> dict:
	if file.filename is None or not file.filename.lower().endswith(".csv"):
		raise HTTPException(status_code=400, detail="Please upload a CSV file.")
	try:
		contents = await file.read()
		if not contents:
			raise HTTPException(status_code=400, detail="CSV file is empty.")
		frame = pd.read_csv(pd.io.common.BytesIO(contents))
		if frame.empty:
			raise HTTPException(status_code=400, detail="CSV file is empty.")
		results = predict_csv_records(frame)
		timestamp = datetime.now(timezone.utc).isoformat()
		save_prediction_records(file.filename, results, "1D CNN", "CSV", timestamp, owner_email)
		return {
			"filename": file.filename,
			"total_records": len(results),
			"successful_predictions": len(results),
			"failed_predictions": 0,
			"results": results,
		}
	except HTTPException:
		raise
	except (ValueError, pd.errors.EmptyDataError, pd.errors.ParserError) as error:
		raise HTTPException(status_code=400, detail=f"Invalid CSV payload: {error}") from error
	except (FileNotFoundError, RuntimeError) as error:
		raise HTTPException(status_code=500, detail="Prediction service artifacts are unavailable.") from error
	except Exception as error:
		raise HTTPException(status_code=500, detail="An internal prediction error occurred.") from error


@app.get("/history", summary="List prediction history")
def history(owner_email: str = Depends(require_owner)) -> dict[str, list[dict]]:
	return {"records": list_prediction_records(owner_email)}


@app.delete("/history/{record_id}", summary="Delete one history record")
def delete_history(
	record_id: str,
	owner_email: str = Depends(require_owner),
) -> dict[str, bool]:
	if not delete_prediction_record(record_id, owner_email):
		raise HTTPException(status_code=404, detail="History record not found.")
	return {"deleted": True}


@app.delete("/history", summary="Clear prediction history")
def clear_history(owner_email: str = Depends(require_owner)) -> dict[str, bool]:
	clear_prediction_records(owner_email)
	return {"cleared": True}
