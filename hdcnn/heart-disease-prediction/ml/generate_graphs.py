"""Generate model-analysis plots from the project’s existing saved artifacts."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_curve,
)
from sklearn.preprocessing import label_binarize

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing import load_and_split_data

DATASET_PATH = PROJECT_ROOT / "data" / "heart_disease_dataset_13k.csv"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "cnn_model.keras"
PREPROCESSOR_PATH = PROJECT_ROOT / "ml" / "models" / "preprocessor.joblib"
MI_SELECTOR_PATH = PROJECT_ROOT / "ml" / "models" / "mi_selector.joblib"
PCA_PATH = PROJECT_ROOT / "ml" / "models" / "pca_transformer.joblib"
CLASS_MAPPING_PATH = PROJECT_ROOT / "ml" / "models" / "class_mapping.json"
SELECTED_FEATURES_PATH = PROJECT_ROOT / "ml" / "models" / "selected_features.csv"
MI_SCORES_PATH = PROJECT_ROOT / "ml" / "outputs" / "mutual_information_scores.csv"
GRAPH_OUTPUT_DIR = PROJECT_ROOT / "ml" / "outputs" / "graphs"


def clean_feature_name(name: str) -> str:
    patched = str(name).replace("numerical__", "").replace("categorical__", "")
    return patched.strip()


def ensure_graph_dir() -> None:
    GRAPH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_saved_artifacts() -> tuple[tf.keras.Model, object, object, object, dict[str, str]]:
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    mi_selector = joblib.load(MI_SELECTOR_PATH)
    pca_transformer = joblib.load(PCA_PATH)
    class_mapping = json.loads(CLASS_MAPPING_PATH.read_text(encoding="utf-8"))
    return model, preprocessor, mi_selector, pca_transformer, class_mapping


def transform_test_data(
    X_test: pd.DataFrame,
    preprocessor: object,
    mi_selector: object | None = None,
    pca_transformer: object | None = None,
) -> np.ndarray:
    processed = np.asarray(preprocessor.transform(X_test), dtype=np.float32)
    expected_features = processed.shape[1]
    if expected_features == 0:
        raise ValueError("Preprocessor produced zero feature columns.")
    return processed.reshape(len(X_test), expected_features, 1)


def save_matplotlib(fig: plt.Figure, output_path: Path) -> None:
    fig.tight_layout()
    fig.savefig(output_path, dpi=300)
    plt.close(fig)


def generate_mutual_information_graph() -> bool:
    if not MI_SCORES_PATH.exists():
        print("NOT GENERATED:")
        print("ml/outputs/graphs/mutual_information_scores.png")
        print("REASON:\nmissing data/artifact")
        return False

    scores = pd.read_csv(MI_SCORES_PATH)
    if {"Feature", "MI_Score"}.difference(scores.columns):
        print("NOT GENERATED:")
        print("ml/outputs/graphs/mutual_information_scores.png")
        print("REASON:\ninvalid MI score schema")
        return False

    frame = scores[["Feature", "MI_Score"]].copy()
    frame["Feature"] = frame["Feature"].map(clean_feature_name)
    frame = frame.sort_values("MI_Score", ascending=False).reset_index(drop=True)

    fig, ax = plt.subplots(figsize=(10, 8), dpi=300)
    ax.barh(frame["Feature"], frame["MI_Score"], color="steelblue")
    ax.invert_yaxis()
    ax.set_title("Mutual Information Feature Scores")
    ax.set_xlabel("Mutual Information Score")
    ax.set_ylabel("Feature")
    ax.grid(axis="x", linestyle="--", alpha=0.3)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "mutual_information_scores.png")
    return True


def generate_selected_mi_features_graph() -> bool:
    if not SELECTED_FEATURES_PATH.exists():
        print("NOT GENERATED:")
        print("ml/outputs/graphs/selected_mi_features.png")
        print("REASON:\nmissing data/artifact")
        return False

    selected = pd.read_csv(SELECTED_FEATURES_PATH)
    if "Feature" not in selected.columns:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/selected_mi_features.png")
        print("REASON:\nselected feature schema missing")
        return False

    features = selected["Feature"].astype(str).map(clean_feature_name).tolist()
    fig, ax = plt.subplots(figsize=(9, 7), dpi=300)
    ax.barh(features, np.ones(len(features)), color="seagreen")
    ax.invert_yaxis()
    ax.set_title("Selected Features After Mutual Information")
    ax.set_xlabel("Selected")
    ax.set_ylabel("Feature")
    ax.set_xticks([])
    ax.grid(axis="x", linestyle="--", alpha=0.2)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "selected_mi_features.png")
    return True


def generate_pca_scree_plot(pca_transformer: object) -> bool:
    explained = getattr(pca_transformer, "explained_variance_ratio_", None)
    if explained is None:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/pca_scree_plot.png")
        print("REASON:\nmissing PCA explained variance ratio")
        return False

    ratios = np.asarray(explained, dtype=float)
    components = np.arange(1, len(ratios) + 1)
    fig, ax = plt.subplots(figsize=(9, 6), dpi=300)
    ax.plot(components, ratios, marker="o", linewidth=2)
    ax.set_title("PCA Scree Plot")
    ax.set_xlabel("Principal Component")
    ax.set_ylabel("Explained Variance Ratio")
    ax.grid(True, alpha=0.3)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "pca_scree_plot.png")
    return True


def generate_pca_cumulative_plot(pca_transformer: object) -> bool:
    explained = getattr(pca_transformer, "explained_variance_ratio_", None)
    if explained is None:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/pca_cumulative_variance.png")
        print("REASON:\nmissing PCA explained variance ratio")
        return False

    ratios = np.asarray(explained, dtype=float)
    cumulative = np.cumsum(ratios)
    n_components = len(ratios)
    fig, ax = plt.subplots(figsize=(9, 6), dpi=300)
    components = np.arange(1, n_components + 1)
    ax.plot(components, cumulative, marker="o", linewidth=2, color="darkorange")
    ax.axhline(0.95, color="red", linestyle="--", linewidth=1.5, label="95% threshold")
    ax.scatter([n_components], [cumulative[-1]], color="black", zorder=5)
    ax.annotate(
        f"Used {n_components} components",
        (n_components, cumulative[-1]),
        textcoords="offset points",
        xytext=(8, 8),
        fontsize=9,
    )
    ax.set_title("PCA Cumulative Explained Variance")
    ax.set_xlabel("Number of Components")
    ax.set_ylabel("Cumulative Explained Variance")
    ax.grid(True, alpha=0.3)
    ax.legend()
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "pca_cumulative_variance.png")
    return True


def find_training_history() -> Path | None:
    candidate_files = [
        PROJECT_ROOT / "ml" / "outputs" / "training_history.csv",
        PROJECT_ROOT / "ml" / "outputs" / "training_history.json",
        PROJECT_ROOT / "ml" / "outputs" / "history.json",
        PROJECT_ROOT / "ml" / "training_history.csv",
        PROJECT_ROOT / "ml" / "training_history.json",
    ]
    for path in candidate_files:
        if path.exists():
            return path
    for directory in [PROJECT_ROOT / "ml", PROJECT_ROOT / "ml" / "outputs"]:
        if directory.exists():
            for item in sorted(directory.iterdir()):
                name = item.name.lower()
                if "training_history" in name or name in {"history.json", "training_history.csv"}:
                    return item
    return None


def generate_training_accuracy_graph(history: pd.DataFrame | None) -> bool:
    if history is None or "accuracy" not in history.columns or "val_accuracy" not in history.columns:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/training_validation_accuracy.png")
        print("REASON:\ntraining history unavailable")
        return False

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    epochs = np.arange(1, len(history) + 1)
    ax.plot(epochs, history["accuracy"], label="Training Accuracy", linewidth=2)
    ax.plot(epochs, history["val_accuracy"], label="Validation Accuracy", linewidth=2)
    ax.set_title("CNN Training and Validation Accuracy")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Accuracy")
    ax.grid(True, alpha=0.3)
    ax.legend()
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "training_validation_accuracy.png")
    return True


def generate_training_loss_graph(history: pd.DataFrame | None) -> bool:
    if history is None or "loss" not in history.columns or "val_loss" not in history.columns:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/training_validation_loss.png")
        print("REASON:\ntraining history unavailable")
        return False

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    epochs = np.arange(1, len(history) + 1)
    ax.plot(epochs, history["loss"], label="Training Loss", linewidth=2)
    ax.plot(epochs, history["val_loss"], label="Validation Loss", linewidth=2)
    ax.set_title("CNN Training and Validation Loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Loss")
    ax.grid(True, alpha=0.3)
    ax.legend()
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "training_validation_loss.png")
    return True


def generate_correlation_matrix_plot() -> bool:
    correlation_path = PROJECT_ROOT / "ml" / "outputs" / "correlation_matrix.csv"
    if not correlation_path.exists():
        print("NOT GENERATED:")
        print("ml/outputs/graphs/correlation_matrix.png")
        print("REASON:\nmissing correlation matrix artifact")
        return False

    frame = pd.read_csv(correlation_path, index_col=0)
    if frame.empty or frame.shape[0] != frame.shape[1]:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/correlation_matrix.png")
        print("REASON:\ninvalid correlation matrix shape")
        return False

    values = frame.to_numpy(dtype=float)
    labels = frame.columns.astype(str).tolist()
    fig, ax = plt.subplots(figsize=(12, 10), dpi=300)
    image = ax.imshow(values, cmap="RdBu_r", vmin=-1.0, vmax=1.0)
    ax.set_title("Feature Correlation Matrix")
    ax.set_xlabel("Feature")
    ax.set_ylabel("Feature")
    ax.set_xticks(np.arange(len(labels)))
    ax.set_yticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right")
    ax.set_yticklabels(labels)
    for row_index in range(values.shape[0]):
        for column_index in range(values.shape[1]):
            value = values[row_index, column_index]
            text_color = "white" if abs(value) > 0.5 else "black"
            ax.text(column_index, row_index, f"{value:.2f}", ha="center", va="center", color=text_color, fontsize=6)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "correlation_matrix.png")
    return True


def generate_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, class_labels: dict[str, str]) -> bool:
    class_ids = sorted(int(k) for k in class_labels)
    class_names = [class_labels[str(index)] for index in class_ids]
    matrix = confusion_matrix(y_true, y_pred, labels=class_ids)
    fig, ax = plt.subplots(figsize=(10, 8), dpi=300)
    image = ax.imshow(matrix, cmap="Blues")
    ax.set_title("Confusion Matrix — Heart Disease Classification")
    ax.set_xlabel("Predicted Class")
    ax.set_ylabel("Actual Class")
    ax.set_xticks(range(len(class_names)))
    ax.set_yticks(range(len(class_names)))
    ax.set_xticklabels(class_names, rotation=45, ha="right")
    ax.set_yticklabels(class_names)
    for row_index, row in enumerate(matrix):
        for column_index, value in enumerate(row):
            ax.text(column_index, row_index, str(value), ha="center", va="center", color="black", fontsize=8)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "confusion_matrix.png")
    return True


def generate_bar_chart(
    title: str,
    values: np.ndarray,
    labels: list[str],
    ylabel: str,
    output_name: str,
    *,
    colors: str | None = None,
) -> bool:
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    bars = ax.bar(range(len(labels)), values, color=colors or "steelblue")
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_ylim(0, 1.1 if max(values) <= 1.0 else None)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right")
    for bar, value in zip(bars, values):
        text = f"{value:.3f}" if value <= 1 else f"{value:.2f}"
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.01, text, ha="center", va="bottom")
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / output_name)
    return True


def generate_class_metric_graphs(y_true: np.ndarray, y_pred: np.ndarray, class_labels: dict[str, str]) -> tuple[dict[str, dict[str, float]], list[float]]:
    class_ids = sorted(int(k) for k in class_labels)
    class_names = [class_labels[str(index)] for index in class_ids]
    precision = precision_score(y_true, y_pred, labels=class_ids, average=None, zero_division=0)
    recall = recall_score(y_true, y_pred, labels=class_ids, average=None, zero_division=0)
    f1 = f1_score(y_true, y_pred, labels=class_ids, average=None, zero_division=0)

    generate_bar_chart("Precision by Disease Class", precision, class_names, "Precision", "precision_by_class.png")
    generate_bar_chart("Recall by Disease Class", recall, class_names, "Recall", "recall_by_class.png")
    generate_bar_chart("F1 Score by Disease Class", f1, class_names, "F1 Score", "f1_by_class.png")

    fig, ax = plt.subplots(figsize=(12, 6), dpi=300)
    x = np.arange(len(class_names))
    width = 0.25
    ax.bar(x - width, precision, width, label="Precision")
    ax.bar(x, recall, width, label="Recall")
    ax.bar(x + width, f1, width, label="F1 Score")
    ax.set_title("Precision, Recall and F1 Score by Class")
    ax.set_ylabel("Score")
    ax.set_xticks(x)
    ax.set_xticklabels(class_names, rotation=45, ha="right")
    ax.set_ylim(0, 1.1)
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "precision_recall_f1.png")

    per_class = {}
    for index, class_name in enumerate(class_names):
        per_class[class_name] = {
            "precision": float(precision[index]),
            "recall": float(recall[index]),
            "f1_score": float(f1[index]),
            "support": int(np.sum(y_true == class_ids[index])),
        }
    return per_class, list(precision)


def generate_roc_graph(y_true: np.ndarray, probabilities: np.ndarray, class_labels: dict[str, str]) -> tuple[np.ndarray, dict[str, float], float, float]:
    class_ids = sorted(int(k) for k in class_labels)
    class_names = [class_labels[str(index)] for index in class_ids]
    y_true_bin = label_binarize(y_true, classes=class_ids)
    roc_aucs = []
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    for index, class_id in enumerate(class_ids):
        fpr, tpr, _ = roc_curve(y_true_bin[:, index], probabilities[:, index])
        roc_auc = auc(fpr, tpr)
        roc_aucs.append(roc_auc)
        ax.plot(fpr, tpr, label=f"{class_names[index]} ({roc_auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", linewidth=1)
    ax.set_title("Multi-Class ROC Curve")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "roc_curve.png")

    roc_auc_by_class = np.asarray(roc_aucs, dtype=float)
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    x = np.arange(len(class_names))
    bar_values = ax.bar(x, roc_auc_by_class, color="darkslateblue")
    ax.set_title("ROC-AUC by Disease Class")
    ax.set_ylabel("ROC-AUC")
    ax.set_ylim(0, 1.1)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    ax.set_xticks(x)
    ax.set_xticklabels(class_names, rotation=45, ha="right")
    for bar, value in zip(bar_values, roc_auc_by_class):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.02, f"{value:.3f}", ha="center", va="bottom")
    save_matplotlib(fig, GRAPH_OUTPUT_DIR / "roc_auc_by_class.png")

    macro_auc = float(np.mean(roc_auc_by_class))
    weights = np.bincount(y_true, minlength=len(class_ids)).astype(float)
    weights = weights / weights.sum() if weights.sum() else np.ones_like(weights) / len(weights)
    weighted_auc = float(np.average(roc_auc_by_class, weights=weights))
    return roc_auc_by_class, {name: float(value) for name, value in zip(class_names, roc_auc_by_class)}, macro_auc, weighted_auc


def generate_model_metrics_json(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    probabilities: np.ndarray,
    class_labels: dict[str, str],
) -> dict[str, object]:
    class_ids = sorted(int(k) for k in class_labels)
    class_names = [class_labels[str(index)] for index in class_ids]
    y_true_array = np.asarray(y_true, dtype=int)
    y_pred_array = np.asarray(y_pred, dtype=int)

    precision_values = precision_score(y_true_array, y_pred_array, labels=class_ids, average=None, zero_division=0)
    recall_values = recall_score(y_true_array, y_pred_array, labels=class_ids, average=None, zero_division=0)
    f1_values = f1_score(y_true_array, y_pred_array, labels=class_ids, average=None, zero_division=0)
    support_values = np.bincount(y_true_array, minlength=len(class_ids))

    roc_auc_by_class, class_auc_map, macro_auc, weighted_auc = generate_roc_graph(y_true_array, probabilities, class_labels)
    payload = {
        "accuracy": float(accuracy_score(y_true_array, y_pred_array)),
        "precision_macro": float(precision_score(y_true_array, y_pred_array, average="macro", zero_division=0)),
        "precision_weighted": float(precision_score(y_true_array, y_pred_array, average="weighted", zero_division=0)),
        "recall_macro": float(recall_score(y_true_array, y_pred_array, average="macro", zero_division=0)),
        "recall_weighted": float(recall_score(y_true_array, y_pred_array, average="weighted", zero_division=0)),
        "f1_macro": float(f1_score(y_true_array, y_pred_array, average="macro", zero_division=0)),
        "f1_weighted": float(f1_score(y_true_array, y_pred_array, average="weighted", zero_division=0)),
        "roc_auc_macro": float(macro_auc),
        "roc_auc_weighted": float(weighted_auc),
        "per_class": [
            {
                "class_id": int(class_id),
                "class": class_name,
                "precision": float(precision_values[index]),
                "recall": float(recall_values[index]),
                "f1_score": float(f1_values[index]),
                "support": int(support_values[index]),
                "roc_auc": float(class_auc_map[class_name]),
            }
            for index, (class_id, class_name) in enumerate(zip(class_ids, class_names))
        ],
    }
    (GRAPH_OUTPUT_DIR / "model_metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main() -> None:
    ensure_graph_dir()
    model, preprocessor, mi_selector, pca_transformer, class_labels = load_saved_artifacts()
    X_train, X_validation, X_test, _, _, y_test = load_and_split_data()
    X_test_cnn = transform_test_data(X_test, preprocessor, mi_selector, pca_transformer)
    probabilities = np.asarray(model.predict(X_test_cnn, verbose=0), dtype=float)
    y_pred = np.argmax(probabilities, axis=1)
    y_true = np.asarray(y_test.to_numpy(), dtype=int)

    if probabilities.shape != (len(X_test), len(class_labels)):
        raise ValueError(f"Probability shape mismatch: expected {(len(X_test), len(class_labels))}, got {probabilities.shape}")
    if not np.all((probabilities >= 0.0) & (probabilities <= 1.0)):
        raise ValueError("Probability values are outside the [0, 1] range.")
    if not np.allclose(probabilities.sum(axis=1), 1.0, atol=1e-6):
        raise ValueError("Probability rows do not sum to approximately 1.")

    status = {
        "Mutual Information": generate_mutual_information_graph(),
        "Selected MI Features": generate_selected_mi_features_graph(),
        "PCA Scree": generate_pca_scree_plot(pca_transformer),
        "PCA Cumulative Variance": generate_pca_cumulative_plot(pca_transformer),
    }

    history_file = find_training_history()
    history_df = None
    if history_file is not None and history_file.suffix.lower() == ".csv":
        history_df = pd.read_csv(history_file)
    elif history_file is not None and history_file.suffix.lower() == ".json":
        try:
            history_df = pd.DataFrame(json.loads(history_file.read_text(encoding="utf-8")))
        except Exception:
            history_df = None

    status["Training/Validation Accuracy"] = generate_training_accuracy_graph(history_df)
    status["Training/Validation Loss"] = generate_training_loss_graph(history_df)

    status["Correlation Matrix"] = generate_correlation_matrix_plot()
    generate_confusion_matrix(y_true, y_pred, class_labels)
    status["Confusion Matrix"] = True

    per_class = generate_class_metric_graphs(y_true, y_pred, class_labels)
    status["Precision"] = True
    status["Recall"] = True
    status["F1 Score"] = True
    status["Precision/Recall/F1"] = True

    _, _, _, _ = generate_roc_graph(y_true, probabilities, class_labels)
    status["ROC Curve"] = True
    status["ROC-AUC"] = True

    metrics_payload = generate_model_metrics_json(y_true, y_pred, probabilities, class_labels)
    status["Metrics JSON"] = True

    print("========================================")
    print("GRAPH GENERATION COMPLETE")
    print("========================================")
    print(f"Mutual Information:\t{('PASS' if status['Mutual Information'] else 'FAIL')}")
    print(f"Selected MI Features:\t{('PASS' if status['Selected MI Features'] else 'FAIL')}")
    print(f"PCA Scree:\t{('PASS' if status['PCA Scree'] else 'FAIL')}")
    print(f"PCA Cumulative Variance:\t{('PASS' if status['PCA Cumulative Variance'] else 'FAIL')}")
    print(f"Training/Validation Accuracy:\t{('PASS' if status['Training/Validation Accuracy'] else 'FAIL')}")
    print(f"Training/Validation Loss:\t{('PASS' if status['Training/Validation Loss'] else 'FAIL')}")
    print(f"Correlation Matrix:\t{('PASS' if status['Correlation Matrix'] else 'FAIL')}")
    print(f"Confusion Matrix:\t{('PASS' if status['Confusion Matrix'] else 'FAIL')}")
    print(f"Precision:\t{('PASS' if status['Precision'] else 'FAIL')}")
    print(f"Recall:\t{('PASS' if status['Recall'] else 'FAIL')}")
    print(f"F1 Score:\t{('PASS' if status['F1 Score'] else 'FAIL')}")
    print(f"Precision/Recall/F1:\t{('PASS' if status['Precision/Recall/F1'] else 'FAIL')}")
    print(f"ROC Curve:\t{('PASS' if status['ROC Curve'] else 'FAIL')}")
    print(f"ROC-AUC:\t{('PASS' if status['ROC-AUC'] else 'FAIL')}")
    print(f"Metrics JSON:\t{('PASS' if status['Metrics JSON'] else 'FAIL')}")
    print("========================================")

    if not status["Training/Validation Accuracy"]:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/training_validation_accuracy.png")
        print("REASON:\ntraining history unavailable")
    if not status["Training/Validation Loss"]:
        print("NOT GENERATED:")
        print("ml/outputs/graphs/training_validation_loss.png")
        print("REASON:\ntraining history unavailable")
    print(f"Saved metrics summary: accuracy={metrics_payload['accuracy']:.6f}, macro_f1={metrics_payload['f1_macro']:.6f}")


if __name__ == "__main__":
    main()
