"""Single-patient inference using the saved heart disease CNN pipeline."""

from pathlib import Path
import sys
from typing import Any, Mapping
from functools import lru_cache
import json
import re
import tempfile
import zipfile

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
	sys.path.insert(0, str(PROJECT_ROOT))

try:
	from ml.preprocessing import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERICAL_FEATURES
except ImportError:
	try:
		from .preprocessing import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERICAL_FEATURES
	except ImportError:
		from preprocessing import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERICAL_FEATURES


ML_DIRECTORY = Path(__file__).resolve().parent
MODEL_DIRECTORY = ML_DIRECTORY / "models"
DATASET_PATH = ML_DIRECTORY.parent / "data" / "heart_disease_dataset_13k.csv"
MODEL_PATH = MODEL_DIRECTORY / "cnn_model.keras"
PREPROCESSOR_PATH = MODEL_DIRECTORY / "preprocessor.joblib"
CLASS_MAPPING_PATH = MODEL_DIRECTORY / "class_mapping.json"
CATEGORICAL_VALUES = {"Gender": {1, 2}, "Family_History": {1, 2}, "Diabetes_Status": {1, 2, 3}}

# These are the only fields accepted by predict_patient(). Identifier and target
# columns are deliberately absent because they are not model features.
EXPECTED_INPUT_FEATURES = FEATURE_COLUMNS


@lru_cache(maxsize=1)
def _load_artifacts() -> tuple[tf.keras.Model, Any, dict[str, str]]:
	"""Load the final CNN, fitted preprocessing, and class-label mapping."""
	paths = {
		"CNN model": MODEL_PATH,
		"preprocessor": PREPROCESSOR_PATH,
		"class mapping": CLASS_MAPPING_PATH,
	}
	missing = [f"{name}: {path}" for name, path in paths.items() if not path.is_file()]
	if missing:
		raise FileNotFoundError("Missing inference artifact(s): " + "; ".join(missing))

	try:
		model = _load_model_with_legacy_batch_norm()
		preprocessor = joblib.load(PREPROCESSOR_PATH)
		class_labels = json.loads(CLASS_MAPPING_PATH.read_text(encoding="utf-8"))
	except Exception as error:
		raise RuntimeError(f"Could not load saved inference artifacts: {error}") from error
	if model.input_shape != (None, len(EXPECTED_INPUT_FEATURES), 1):
		raise ValueError(f"Saved CNN expects an invalid input shape: {model.input_shape}")
	if model.output_shape != (None, len(class_labels)):
		raise ValueError(f"Saved CNN has an invalid output shape: {model.output_shape}")
	return model, preprocessor, class_labels


def _load_model_with_legacy_batch_norm() -> tf.keras.Model:
	"""Load the frozen model after removing only Keras 2-only normalization fields."""
	def remove_obsolete_fields(value: Any) -> Any:
		if isinstance(value, dict):
			for obsolete_key in (
				"renorm",
				"renorm_clipping",
				"renorm_momentum",
			):
				value.pop(obsolete_key, None)
			for key, nested_value in value.items():
				value[key] = remove_obsolete_fields(nested_value)
		elif isinstance(value, list):
			for index, nested_value in enumerate(value):
				value[index] = remove_obsolete_fields(nested_value)
		return value

	with tempfile.TemporaryDirectory() as temporary_directory:
		compatible_path = Path(temporary_directory) / MODEL_PATH.name
		with zipfile.ZipFile(MODEL_PATH) as source_archive:
			with zipfile.ZipFile(compatible_path, "w") as target_archive:
				for member in source_archive.infolist():
					if member.filename == "config.json":
						config = remove_obsolete_fields(json.loads(source_archive.read(member)))
						contents = json.dumps(config).encode("utf-8")
						archive_member = zipfile.ZipInfo(member.filename)
						archive_member.compress_type = zipfile.ZIP_DEFLATED
						target_archive.writestr(archive_member, contents)
					else:
						target_archive.writestr(member, source_archive.read(member))
		return tf.keras.models.load_model(compatible_path, compile=False)


def _validate_patient_data(
	patient_data: Mapping[str, Any],
	preprocessor: Any,
) -> pd.DataFrame:
	"""Validate one patient and return a one-row dataframe in training order."""
	if not isinstance(patient_data, Mapping):
		raise TypeError("patient_data must be a dictionary or mapping of feature names to values.")

	provided_features = set(patient_data)
	expected_features = set(EXPECTED_INPUT_FEATURES)
	missing_features = sorted(expected_features - provided_features)
	unexpected_features = sorted(provided_features - expected_features)
	if missing_features:
		raise ValueError(f"Missing required feature(s): {missing_features}")
	if unexpected_features:
		raise ValueError(
			f"Unexpected feature name(s): {unexpected_features}. "
			"Diagnosis_Class and Diagnosis_Label are not accepted."
		)

	validated_data = {}
	for feature in NUMERICAL_FEATURES:
		value = patient_data[feature]
		if isinstance(value, (bool, np.bool_)):
			raise ValueError(f"Numerical feature '{feature}' must not be boolean.")
		try:
			numeric_value = float(value)
		except (TypeError, ValueError) as error:
			raise ValueError(f"Numerical feature '{feature}' must be numeric.") from error
		if not np.isfinite(numeric_value):
			raise ValueError(f"Numerical feature '{feature}' must be finite.")
		validated_data[feature] = numeric_value

	for feature in CATEGORICAL_FEATURES:
		value = patient_data[feature]
		if pd.isna(value):
			raise ValueError(f"Categorical feature '{feature}' cannot be missing.")
		if value not in CATEGORICAL_VALUES[feature]:
			raise ValueError(
				f"Invalid value for categorical feature '{feature}': {value!r}. "
				f"Expected one of {sorted(CATEGORICAL_VALUES[feature])}."
			)
		validated_data[feature] = value

	return pd.DataFrame([validated_data], columns=EXPECTED_INPUT_FEATURES)


def load_feature_metadata(dataset_path: Path | str = DATASET_PATH) -> dict[str, Any]:
	"""Return dataset-derived value ranges and categorical domains for every accepted feature."""
	dataset = Path(dataset_path)
	if not dataset.is_file():
		raise FileNotFoundError(f"Dataset not found: {dataset}")
	
	frame = pd.read_csv(dataset)
	features: dict[str, Any] = {}
	for feature in EXPECTED_INPUT_FEATURES:
		series = frame[feature]
		if feature in NUMERICAL_FEATURES:
			features[feature] = {
				"type": "numeric",
				"min": float(series.min()),
				"max": float(series.max()),
				"values": [float(series.min()), float(series.max())],
			}
		else:
			ordered_values = sorted(series.dropna().astype(str).unique().tolist())
			features[feature] = {
				"type": "categorical",
				"values": ordered_values,
			}
	return {
		"feature_count": len(EXPECTED_INPUT_FEATURES),
		"dataset_path": str(dataset),
		"features": features,
	}


@lru_cache(maxsize=1)
def _load_feature_impact_reference_values() -> dict[str, tuple[float, float]]:
	"""Load the training-data 25th and 75th percentiles used for impact analysis."""
	if not DATASET_PATH.is_file():
		raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
	frame = pd.read_csv(DATASET_PATH, usecols=list(NUMERICAL_FEATURES))
	quartiles = frame.quantile([0.25, 0.75])
	return {
		feature: (
			float(quartiles.loc[0.25, feature]),
			float(quartiles.loc[0.75, feature]),
		)
		for feature in NUMERICAL_FEATURES
	}


def validate_csv_frame(dataframe: pd.DataFrame, preprocessor: Any) -> pd.DataFrame:
	"""Validate a CSV payload and coerce it to the exact accepted feature order.

	The API accepts optional diagnosis metadata columns if they are present in user-supplied
	upload files, but they are ignored
	for model inference and never returned to the UI as prediction output.
	"""
	if dataframe.empty:
		raise ValueError("CSV file is empty.")

	working_frame = dataframe.copy()
	provided = set(working_frame.columns)
	expected = set(EXPECTED_INPUT_FEATURES)
	missing_features = sorted(expected - provided)
	unexpected_features = sorted(provided - expected)
	if missing_features:
		raise ValueError(f"CSV file is missing required feature column(s): {missing_features}")
	if unexpected_features:
		raise ValueError(
			f"CSV file contains unexpected column(s): {unexpected_features}. "
			"Only the 23 accepted model feature columns are allowed."
		)

	validated_frames: list[pd.DataFrame] = []
	for row_index, row in working_frame[EXPECTED_INPUT_FEATURES].iterrows():
		row_dict = row.to_dict()
		try:
			validated_frames.append(_validate_patient_data(row_dict, preprocessor))
		except ValueError as error:
			raise ValueError(f"Row {row_index + 2}: {error}") from error
	return pd.concat(validated_frames, ignore_index=True)


def predict_patient(patient_data: Mapping[str, Any]) -> dict[str, Any]:
	"""Predict one patient's class using the final 1D CNN pipeline."""
	model, preprocessor, class_labels = _load_artifacts()
	num_classes = len(class_labels)
	patient_frame = _validate_patient_data(patient_data, preprocessor)
	patient_processed = np.asarray(preprocessor.transform(patient_frame), dtype=np.float32)
	if patient_processed.shape != (1, len(EXPECTED_INPUT_FEATURES)):
		raise ValueError(f"Unexpected preprocessed patient shape: {patient_processed.shape}")
	patient_cnn = patient_processed.reshape(1, len(EXPECTED_INPUT_FEATURES), 1)
	if not np.isfinite(patient_cnn).all():
		raise ValueError("NaN or infinite values found after patient transformation.")

	probabilities_array = np.asarray(model.predict(patient_cnn, verbose=0), dtype=float)
	if probabilities_array.shape != (1, num_classes):
		raise ValueError(f"CNN probability output must have shape (1, {num_classes}), got {probabilities_array.shape}.")
	if not np.isfinite(probabilities_array).all():
		raise ValueError("CNN prediction contains NaN or infinite probabilities.")
	probabilities_array = probabilities_array[0]
	probability_sum = float(probabilities_array.sum())
	if not np.isclose(probability_sum, 1.0, atol=1e-6):
		raise ValueError(f"CNN probabilities must sum to 1; got {probability_sum:.8f}.")

	predicted_class = int(np.argmax(probabilities_array))
	impact_analysis = _build_feature_impact_analysis(
		patient_frame,
		model,
		preprocessor,
		predicted_class,
		probabilities_array,
		class_labels,
	)
	return {
		"predicted_class": predicted_class,
		"predicted_label": class_labels[str(predicted_class)],
		"confidence": float(probabilities_array[predicted_class]),
		"probabilities": {
			str(class_number): float(probabilities_array[class_number])
			for class_number in range(num_classes)
		},
		"affected_attributes": impact_analysis["affected_attributes"],
		"impact_graph": impact_analysis["impact_graph"],
	}


def _build_feature_impact_analysis(
	patient_frame: pd.DataFrame,
	model: tf.keras.Model,
	preprocessor: Any,
	predicted_class: int,
	baseline_probabilities: np.ndarray,
	class_labels: Mapping[str, str],
) -> dict[str, Any]:
	"""Measure patient-specific changes to the predicted class's odds versus all other classes."""
	reference_values = _load_feature_impact_reference_values()
	epsilon = 1e-7
	baseline_class_probability = float(baseline_probabilities[predicted_class])
	baseline_log_odds = float(
		np.log(
			np.clip(baseline_class_probability, epsilon, 1.0)
			/ np.clip(1.0 - baseline_class_probability, epsilon, 1.0)
		)
	)

	candidate_frames: list[pd.DataFrame] = []
	candidate_features: list[str] = []
	for feature in EXPECTED_INPUT_FEATURES:
		original_value = patient_frame.iloc[0][feature]
		if feature in NUMERICAL_FEATURES:
			candidate_values = reference_values[feature]
		else:
			candidate_values = sorted(CATEGORICAL_VALUES[feature])

		for candidate_value in candidate_values:
			if candidate_value == original_value:
				continue
			candidate = patient_frame.copy()
			candidate.at[0, feature] = candidate_value
			candidate_frames.append(candidate)
			candidate_features.append(feature)

	candidate_changes: dict[str, list[float]] = {
		feature: [] for feature in EXPECTED_INPUT_FEATURES
	}
	if candidate_frames:
		candidate_frame = pd.concat(candidate_frames, ignore_index=True)
		processed = np.asarray(preprocessor.transform(candidate_frame), dtype=np.float32)
		if processed.shape != (len(candidate_frames), len(EXPECTED_INPUT_FEATURES)):
			raise ValueError(f"Unexpected preprocessed impact input shape: {processed.shape}")
		candidate_input = processed.reshape(
			len(candidate_frames), len(EXPECTED_INPUT_FEATURES), 1
		)
		predictions = np.asarray(model.predict(candidate_input, batch_size=128, verbose=0), dtype=float)
		if predictions.shape != (len(candidate_frames), len(class_labels)):
			raise ValueError("CNN impact analysis returned an unexpected probability shape.")
		if not np.isfinite(predictions).all():
			raise ValueError("CNN impact analysis returned invalid probabilities.")
		for feature, prediction in zip(candidate_features, predictions):
			probability = float(prediction[predicted_class])
			log_odds = float(
				np.log(
					np.clip(probability, epsilon, 1.0)
					/ np.clip(1.0 - probability, epsilon, 1.0)
				)
			)
			candidate_changes[feature].append(log_odds - baseline_log_odds)

	feature_results: list[dict[str, Any]] = []
	for feature in EXPECTED_INPUT_FEATURES:
		change_signs = candidate_changes[feature]
		impact_score = max((abs(change) for change in change_signs), default=0.0)
		if impact_score == 0.0:
			impact_level = "low"
			direction = "no change"
		else:
			if max(change_signs) <= 1e-12:
				direction = "decreases odds of the predicted disease class"
			elif min(change_signs) >= -1e-12:
				direction = "increases odds of the predicted disease class"
			else:
				direction = "mixed effect on predicted-class odds"
			impact_level = "high" if impact_score >= 0.20 else "medium" if impact_score >= 0.08 else "low"

		feature_results.append(
			{
				"feature": feature,
				"current_value": original_value,
				"direction": direction,
				"impact_score": round(float(impact_score), 6),
				"impact_level": impact_level,
				"predicted_class": predicted_class,
				"predicted_label": class_labels[str(predicted_class)],
			}
		)

	max_impact = max((item["impact_score"] for item in feature_results), default=0.0)
	for item in feature_results:
		item["impact_score"] = round(item["impact_score"] / max(max_impact, 1e-9), 5)
		if item["impact_score"] >= 0.8:
			item["impact_level"] = "high"
		elif item["impact_score"] >= 0.45:
			item["impact_level"] = "medium"
		else:
			item["impact_level"] = "low"

	feature_results.sort(key=lambda item: (-item["impact_score"], item["feature"]))
	items = [
		{
			"feature": item["feature"],
			"current_value": item["current_value"],
			"direction": item["direction"],
			"impact_score": item["impact_score"],
			"impact_level": item["impact_level"],
			"predicted_class": item["predicted_class"],
			"predicted_label": item["predicted_label"],
		}
		for item in feature_results
	]
	return {
		"affected_attributes": items,
		"impact_graph": {
			"title": "Predicted disease attribute impact",
			"predicted_class": predicted_class,
			"predicted_label": class_labels[str(predicted_class)],
			"items": items,
		},
	}


def predict_csv_rows(dataframe: pd.DataFrame) -> dict[str, Any]:
	"""Predict multiple rows from a CSV payload with the final CNN."""
	model, preprocessor, class_labels = _load_artifacts()
	num_classes = len(class_labels)
	validated_frame = validate_csv_frame(dataframe, preprocessor)
	processed = np.asarray(preprocessor.transform(validated_frame), dtype=np.float32)
	if processed.shape != (len(validated_frame), len(EXPECTED_INPUT_FEATURES)):
		raise ValueError(f"Unexpected preprocessed CSV shape: {processed.shape}")
	cnn_input = processed.reshape(len(validated_frame), len(EXPECTED_INPUT_FEATURES), 1)
	probability_matrix = np.asarray(model.predict(cnn_input, batch_size=256, verbose=0), dtype=float)
	if probability_matrix.shape != (len(validated_frame), num_classes):
		raise ValueError("The CNN CSV prediction output has an unexpected shape.")
	if not np.isfinite(probability_matrix).all():
		raise ValueError("CNN CSV prediction contains invalid probabilities.")
	if not np.allclose(probability_matrix.sum(axis=1), 1.0, atol=1e-6):
		raise ValueError("CNN CSV prediction probabilities must sum to 1 for every row.")
	predictions: list[dict[str, Any]] = []
	for index, probability_row in enumerate(probability_matrix):
		probability_array = np.asarray(probability_row, dtype=float)
		predicted_class = int(np.argmax(probability_array))
		predictions.append(
			{
				"row_index": index,
				"predicted_class": predicted_class,
				"predicted_label": class_labels[str(predicted_class)],
				"confidence": float(probability_array[predicted_class]),
				"probabilities": {
					str(class_number): float(probability_array[class_number])
					for class_number in range(num_classes)
				},
			}
		)
	return {
		"rows_processed": len(predictions),
		"predictions": predictions,
		"summary": {
			"total_rows": len(predictions),
			"average_confidence": float(np.mean([item["confidence"] for item in predictions])) if predictions else 0.0,
			"predicted_classes": {str(class_number): sum(1 for item in predictions if item["predicted_class"] == class_number) for class_number in range(num_classes)},
		},
	}


def _probability_column_name(label: str, used_names: set[str]) -> str:
	"""Create a stable CSV column name without changing the saved class label."""
	base_name = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_") or "Class"
	column_name = f"Probability_{base_name}"
	suffix = 2
	while column_name in used_names:
		column_name = f"Probability_{base_name}_{suffix}"
		suffix += 1
	return column_name


def predict_csv_frame(dataframe: pd.DataFrame) -> pd.DataFrame:
	"""Return original input columns with model predictions appended."""
	if dataframe.empty:
		raise ValueError("CSV file is empty.")
	model, preprocessor, class_labels = _load_artifacts()
	validated_frame = validate_csv_frame(dataframe, preprocessor)
	num_classes = len(class_labels)
	processed = np.asarray(preprocessor.transform(validated_frame), dtype=np.float32)
	if processed.shape != (len(validated_frame), len(EXPECTED_INPUT_FEATURES)):
		raise ValueError(f"Unexpected preprocessed CSV shape: {processed.shape}")
	cnn_input = processed.reshape(len(validated_frame), len(EXPECTED_INPUT_FEATURES), 1)
	probability_matrix = np.asarray(model.predict(cnn_input, batch_size=256, verbose=0), dtype=float)
	if probability_matrix.shape != (len(validated_frame), num_classes):
		raise ValueError("The CNN CSV prediction output has an unexpected shape.")
	if not np.isfinite(probability_matrix).all():
		raise ValueError("CNN CSV prediction contains invalid probabilities.")
	if not np.allclose(probability_matrix.sum(axis=1), 1.0, atol=1e-6):
		raise ValueError("CNN prediction probabilities must sum to 1 for every row.")

	result = dataframe.copy()
	predicted_classes = np.argmax(probability_matrix, axis=1).astype(int)
	result["Prediction_Class"] = predicted_classes
	result["Prediction_Label"] = [class_labels[str(class_number)] for class_number in predicted_classes]
	result["Prediction_Confidence"] = probability_matrix[np.arange(len(result)), predicted_classes] * 100
	used_names = set(result.columns)
	for class_number in range(num_classes):
		column_name = _probability_column_name(class_labels[str(class_number)], used_names)
		used_names.add(column_name)
		result[column_name] = probability_matrix[:, class_number]
	return result


def predict_csv_records(dataframe: pd.DataFrame) -> list[dict[str, Any]]:
	"""Return JSON-safe row results without exposing probability implementation columns."""
	result_frame = predict_csv_frame(dataframe)
	result_frame["Prediction_Status"] = "Success"
	return [
		{
			key: value.item() if isinstance(value, np.generic) else value
			for key, value in record.items()
		if not key.startswith("Probability_")
		}
		for record in result_frame.to_dict(orient="records")
	]


if __name__ == "__main__":
	# Use one real row only as a CLI smoke test; target and identifier fields are
	# removed before the row enters the reusable inference function.
	sample = pd.read_csv(DATASET_PATH).iloc[0].to_dict()
	sample.pop("Diagnosis_Class", None)
	sample.pop("Diagnosis_Label", None)
	result = predict_patient(sample)
	probability_sum = sum(result["probabilities"].values())
	print("Input validation: PASS")
	print(f"Predicted class: {result['predicted_class']}")
	print(f"Confidence: {result['confidence']:.6f}")
	print("Class probabilities:")
	for class_number, probability in result["probabilities"].items():
		print(f"  Class {class_number}: {probability:.6f}")
	print(f"Probability sum: {probability_sum:.6f}")
	print("Inference validation checks: PASS")
