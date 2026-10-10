"""Comprehensive evaluation of the trained heart disease CNN."""

from pathlib import Path
import sys
import json
from datetime import datetime, timezone

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import (
	accuracy_score,
	classification_report,
	confusion_matrix,
	precision_recall_fscore_support,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
	sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing import load_and_split_data


NUM_CLASSES = 0
OUTPUT_DIRECTORY = Path(__file__).resolve().parent / "outputs"
MODEL_DIRECTORY = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIRECTORY / "cnn_model.keras"
PREPROCESSOR_PATH = MODEL_DIRECTORY / "preprocessor.joblib"
MI_SELECTOR_PATH = MODEL_DIRECTORY / "mi_selector.joblib"
PCA_PATH = MODEL_DIRECTORY / "pca_transformer.joblib"
CLASS_MAPPING_PATH = MODEL_DIRECTORY / "class_mapping.json"
SELECTED_FEATURES_PATH = MODEL_DIRECTORY / "selected_features.csv"
CONFUSION_MATRIX_PATH = OUTPUT_DIRECTORY / "confusion_matrix.png"
CONFUSION_MATRIX_CSV_PATH = OUTPUT_DIRECTORY / "confusion_matrix.csv"
PER_CLASS_METRICS_PATH = OUTPUT_DIRECTORY / "per_class_metrics.csv"
PER_CLASS_PERFORMANCE_PATH = OUTPUT_DIRECTORY / "per_class_performance.png"
PREDICTIONS_PATH = OUTPUT_DIRECTORY / "test_predictions.csv"
ANALYSIS_PATH = OUTPUT_DIRECTORY / "model_analysis.json"
DATASET_NAME = "heart_disease_dataset_13k.csv"
DATASET_PATH = PROJECT_ROOT / "data" / DATASET_NAME


def load_evaluation_artifacts() -> tuple[tf.keras.Model, object, object, object, dict[str, str]]:
	"""Load the trained CNN and already-fitted sklearn transformations."""
	model = tf.keras.models.load_model(MODEL_PATH)
	preprocessor = joblib.load(PREPROCESSOR_PATH)
	mi_selector = joblib.load(MI_SELECTOR_PATH)
	pca_transformer = joblib.load(PCA_PATH)
	class_labels = json.loads(CLASS_MAPPING_PATH.read_text(encoding="utf-8"))
	return model, preprocessor, mi_selector, pca_transformer, class_labels


def transform_test_data(
	X_test: pd.DataFrame,
	preprocessor: object,
	mi_selector: object,
	pca_transformer: object,
) -> np.ndarray:
	"""Apply fitted transformations to test data without fitting anything."""
	X_test_processed = preprocessor.transform(X_test)
	X_test_selected = mi_selector.transform(X_test_processed)
	X_test_pca = pca_transformer.transform(X_test_selected)
	return X_test_pca.reshape(X_test_pca.shape[0], X_test_pca.shape[1], 1)


def calculate_metrics(
	y_true: pd.Series,
	y_pred: np.ndarray,
) -> dict[str, float]:
	"""Calculate weighted and macro classification metrics."""
	weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
		y_true,
		y_pred,
		average="weighted",
		zero_division=0,
	)
	macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
		y_true,
		y_pred,
		average="macro",
		zero_division=0,
	)
	return {
		"accuracy": accuracy_score(y_true, y_pred),
		"weighted_precision": weighted_precision,
		"weighted_recall": weighted_recall,
		"weighted_f1": weighted_f1,
		"macro_precision": macro_precision,
		"macro_recall": macro_recall,
		"macro_f1": macro_f1,
	}


def save_confusion_matrix_plot(matrix: np.ndarray) -> None:
	"""Save a high-resolution confusion matrix plot."""
	figure, axis = plt.subplots(figsize=(8, 7), dpi=300)
	image = axis.imshow(matrix, cmap="Blues")
	axis.set_title("CNN Confusion Matrix")
	axis.set_xlabel("Predicted Class")
	axis.set_ylabel("True Class")
	axis.set_xticks(range(NUM_CLASSES), range(NUM_CLASSES))
	axis.set_yticks(range(NUM_CLASSES), range(NUM_CLASSES))
	for row in range(NUM_CLASSES):
		for column in range(NUM_CLASSES):
			axis.text(column, row, matrix[row, column], ha="center", va="center", color="black")
	figure.colorbar(image, ax=axis, fraction=0.046, pad=0.04)
	figure.tight_layout()
	figure.savefig(CONFUSION_MATRIX_PATH, dpi=300)
	plt.close(figure)


def save_per_class_metrics(y_true: pd.Series, y_pred: np.ndarray) -> pd.DataFrame:
	"""Calculate and save precision, recall, F1, support, and class accuracy."""
	precision, recall, f1_score, support = precision_recall_fscore_support(
		y_true,
		y_pred,
		labels=list(range(NUM_CLASSES)),
		zero_division=0,
	)
	class_matrix = confusion_matrix(y_true, y_pred, labels=list(range(NUM_CLASSES)))
	class_totals = class_matrix.sum(axis=1)
	class_accuracy = np.divide(
		np.diag(class_matrix),
		class_totals,
		out=np.zeros(NUM_CLASSES, dtype=float),
		where=class_totals != 0,
	)
	metrics = pd.DataFrame(
		{
			"Class": range(NUM_CLASSES),
			"Precision": precision,
			"Recall": recall,
			"F1-score": f1_score,
			"Support": support,
			"Class_Accuracy": class_accuracy,
		}
	)
	metrics.to_csv(PER_CLASS_METRICS_PATH, index=False)
	return metrics


def save_per_class_performance_plot(metrics: pd.DataFrame) -> None:
	"""Save grouped precision, recall, and F1-score bars for each class."""
	figure, axis = plt.subplots(figsize=(10, 6), dpi=300)
	positions = np.arange(NUM_CLASSES)
	bar_width = 0.25
	axis.bar(positions - bar_width, metrics["Precision"], bar_width, label="Precision")
	axis.bar(positions, metrics["Recall"], bar_width, label="Recall")
	axis.bar(positions + bar_width, metrics["F1-score"], bar_width, label="F1-score")
	axis.set_xlabel("Class")
	axis.set_ylabel("Score")
	axis.set_xticks(positions, metrics["Class"])
	axis.set_ylim(0, 1)
	axis.legend()
	figure.tight_layout()
	figure.savefig(PER_CLASS_PERFORMANCE_PATH, dpi=300)
	plt.close(figure)


def save_prediction_results(
	y_true: pd.Series,
	y_pred: np.ndarray,
	y_pred_prob: np.ndarray,
) -> None:
	"""Save class predictions, confidence, and all class probabilities."""
	predictions = pd.DataFrame(
		{
			"True_Class": y_true.to_numpy(),
			"Predicted_Class": y_pred,
			"Confidence": y_pred_prob.max(axis=1),
		}
	)
	for class_number in range(NUM_CLASSES):
		predictions[f"Probability_Class_{class_number}"] = y_pred_prob[:, class_number]
	predictions.to_csv(PREDICTIONS_PATH, index=False)


def calculate_permutation_importance(
	X_test: pd.DataFrame,
	y_test: pd.Series,
	preprocessor: object,
	mi_selector: object,
	pca_transformer: object,
	model: tf.keras.Model,
) -> list[dict[str, float | int | str]]:
	"""Measure raw-feature importance by test-set permutation accuracy drop."""
	def predict_features(features: pd.DataFrame) -> np.ndarray:
		processed = preprocessor.transform(features)
		selected = mi_selector.transform(processed)
		transformed = pca_transformer.transform(selected).reshape(len(features), 15, 1)
		return np.argmax(model.predict(transformed, verbose=0), axis=1)

	baseline_accuracy = accuracy_score(y_test, predict_features(X_test))
	importance_rows: list[dict[str, float | int | str]] = []
	random_generator = np.random.default_rng(42)
	for feature in X_test.columns:
		drops = []
		for _ in range(5):
			permuted = X_test.copy()
			permuted[feature] = random_generator.permutation(permuted[feature].to_numpy())
			permuted_accuracy = accuracy_score(y_test, predict_features(permuted))
			drops.append(float(baseline_accuracy - permuted_accuracy))
		importance_rows.append(
			{
				"feature": feature,
				"importance": float(np.mean(drops)),
				"importance_std": float(np.std(drops)),
				"rank": 0,
			}
		)
	importance_rows.sort(key=lambda item: float(item["importance"]), reverse=True)
	for rank, item in enumerate(importance_rows, start=1):
		item["rank"] = rank
	return importance_rows


def save_model_analysis(
	X_train: pd.DataFrame,
	X_validation: pd.DataFrame,
	X_test: pd.DataFrame,
	y_test: pd.Series,
	y_pred: np.ndarray,
	metrics: dict[str, float],
	model: tf.keras.Model,
	preprocessor: object,
	mi_selector: object,
	pca_transformer: object,
	class_labels: dict[str, str],
	training_history: pd.DataFrame,
) -> None:
	"""Persist the complete latest analysis consumed by the frontend."""
	labels = [class_labels[str(class_number)] for class_number in range(NUM_CLASSES)]
	dataset = pd.read_csv(DATASET_PATH)
	matrix = confusion_matrix(y_test, y_pred, labels=list(range(NUM_CLASSES)))
	classification = classification_report(
		y_test,
		y_pred,
		labels=list(range(NUM_CLASSES)),
		target_names=labels,
		output_dict=True,
		zero_division=0,
	)
	class_distribution = []
	counts = y_test.value_counts().reindex(range(NUM_CLASSES), fill_value=0)
	all_counts = dataset["Diagnosis_Class"].value_counts().reindex(range(NUM_CLASSES), fill_value=0)
	for class_number in range(NUM_CLASSES):
		class_distribution.append(
			{
				"class_id": class_number,
				"label": labels[class_number],
				"count": int(all_counts[class_number]),
				"test_count": int(counts[class_number]),
				"percentage": float(all_counts[class_number] / len(dataset) * 100),
			}
		)
	selected_features = pd.read_csv(SELECTED_FEATURES_PATH)["Feature"].astype(str).tolist()
	analysis = {
		"dataset_name": DATASET_NAME,
		"dataset_size": int(len(dataset)),
		"input_feature_count": int(len(X_test.columns)),
		"feature_names": X_test.columns.tolist(),
		"model_name": "1D CNN",
		"training_date": datetime.fromtimestamp(MODEL_PATH.stat().st_mtime, timezone.utc).isoformat(),
		"test_accuracy": metrics["accuracy"],
		"validation_accuracy": float(training_history["val_accuracy"].max()),
		"test_loss": float(model.evaluate(transform_test_data(X_test, preprocessor, mi_selector, pca_transformer), y_test, verbose=0)[0]),
		"precision_macro": metrics["macro_precision"],
		"recall_macro": metrics["macro_recall"],
		"f1_macro": metrics["macro_f1"],
		"precision_weighted": metrics["weighted_precision"],
		"recall_weighted": metrics["weighted_recall"],
		"f1_weighted": metrics["weighted_f1"],
		"classification_report": classification,
		"confusion_matrix": matrix.tolist(),
		"class_labels": class_labels,
		"class_distribution": class_distribution,
		"train_size": int(len(X_train)),
		"validation_size": int(len(X_validation)),
		"test_size": int(len(y_test)),
		"training_epochs": int(len(training_history)),
		"best_validation_epoch": int(training_history["val_accuracy"].idxmax() + 1),
		"final_training_accuracy": float(training_history["accuracy"].iloc[-1]),
		"final_training_loss": float(training_history["loss"].iloc[-1]),
		"best_validation_loss": float(training_history["val_loss"].min()),
		"preprocessing_method": "Training-only MinMaxScaler and OneHotEncoder",
		"feature_selection_method": "Mutual information on training data; permutation importance on held-out test data",
		"selected_features": selected_features,
		"feature_importance": calculate_permutation_importance(X_test, y_test, preprocessor, mi_selector, pca_transformer, model),
	}
	ANALYSIS_PATH.write_text(json.dumps(analysis, indent=2), encoding="utf-8")


def verify_evaluation(
	X_test_cnn: np.ndarray,
	y_test: pd.Series,
	y_pred: np.ndarray,
	y_pred_prob: np.ndarray,
	matrix: np.ndarray,
) -> None:
	"""Verify test size, class coverage, matrix shape, and finite values."""
	if len(y_test) != len(y_pred):
		raise ValueError("Evaluation test samples and predictions must have the same size.")
	if set(y_test.unique()) != set(range(NUM_CLASSES)):
		raise ValueError("The test set does not contain every detected class.")
	if matrix.shape != (NUM_CLASSES, NUM_CLASSES):
		raise ValueError(f"The confusion matrix must be {NUM_CLASSES} x {NUM_CLASSES}.")
	if X_test_cnn.shape[0] != len(y_test) or X_test_cnn.shape[1:] != (15, 1):
		raise ValueError(f"Unexpected CNN test shape: {X_test_cnn.shape}")
	if np.isnan(y_pred_prob).any() or np.isinf(y_pred_prob).any():
		raise ValueError("Invalid NaN or infinite prediction probabilities found.")
	print("Test sample and prediction counts: PASS")
	print(f"{NUM_CLASSES} detected classes present: PASS")
	print(f"Confusion matrix shape ({NUM_CLASSES} x {NUM_CLASSES}): PASS")
	print("NaN and infinite-value checks: PASS")


def main() -> None:
	"""Evaluate the saved CNN on the untouched stratified test split."""
	global NUM_CLASSES
	X_train, X_validation, X_test, _, _, y_test = load_and_split_data()
	model, preprocessor, mi_selector, pca_transformer, class_labels = load_evaluation_artifacts()
	NUM_CLASSES = len(class_labels)
	X_test_cnn = transform_test_data(
		X_test,
		preprocessor,
		mi_selector,
		pca_transformer,
	)
	y_pred_prob = model.predict(X_test_cnn, verbose=0)
	y_pred = np.argmax(y_pred_prob, axis=1)
	metrics = calculate_metrics(y_test, y_pred)
	matrix = confusion_matrix(y_test, y_pred, labels=list(range(NUM_CLASSES)))
	per_class_metrics = save_per_class_metrics(y_test, y_pred)
	OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
	pd.DataFrame(matrix, index=range(NUM_CLASSES), columns=range(NUM_CLASSES)).to_csv(
		CONFUSION_MATRIX_CSV_PATH,
		index_label="True_Class",
	)
	save_confusion_matrix_plot(matrix)
	save_per_class_performance_plot(per_class_metrics)
	save_prediction_results(y_test, y_pred, y_pred_prob)
	training_history = pd.read_csv(OUTPUT_DIRECTORY / "training_history.csv")
	save_model_analysis(
		X_train,
		X_validation,
		X_test,
		y_test,
		y_pred,
		metrics,
		model,
		preprocessor,
		mi_selector,
		pca_transformer,
		class_labels,
		training_history,
	)
	verify_evaluation(X_test_cnn, y_test, y_pred, y_pred_prob, matrix)

	confidence = y_pred_prob.max(axis=1)
	print("\n" + "=" * 60)
	print("CNN MODEL EVALUATION REPORT")
	print("=" * 60)
	print(f"Test Samples: {len(y_test)}")
	print(f"Correct Predictions: {(y_test.to_numpy() == y_pred).sum()}")
	print(f"Incorrect Predictions: {(y_test.to_numpy() != y_pred).sum()}")
	print(f"Accuracy: {metrics['accuracy']:.6f}")
	print(f"Weighted Precision: {metrics['weighted_precision']:.6f}")
	print(f"Weighted Recall: {metrics['weighted_recall']:.6f}")
	print(f"Weighted F1: {metrics['weighted_f1']:.6f}")
	print(f"Macro Precision: {metrics['macro_precision']:.6f}")
	print(f"Macro Recall: {metrics['macro_recall']:.6f}")
	print(f"Macro F1: {metrics['macro_f1']:.6f}")
	print(f"Mean Prediction Confidence: {confidence.mean():.6f}")
	print(f"Median Prediction Confidence: {np.median(confidence):.6f}")
	print(f"Minimum Prediction Confidence: {confidence.min():.6f}")
	print(f"Maximum Prediction Confidence: {confidence.max():.6f}")
	print("\nComplete Classification Report:")
	print(classification_report(y_test, y_pred, labels=list(range(NUM_CLASSES)), zero_division=0))
	print("\nGenerated evaluation files:")
	for path in (
		CONFUSION_MATRIX_PATH,
		CONFUSION_MATRIX_CSV_PATH,
		PER_CLASS_METRICS_PATH,
		PER_CLASS_PERFORMANCE_PATH,
		PREDICTIONS_PATH,
	):
		print(path)


if __name__ == "__main__":
	main()
