"""Create reproducible stratified train, validation, and test splits."""

from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder


DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "heart_disease_dataset_13k.csv"
RANDOM_STATE = 42
IDENTIFIER_COLUMN = None
DESCRIPTIVE_TARGET_COLUMN = "Diagnosis_Label"
TARGET_COLUMN = "Diagnosis_Class"
CATEGORICAL_FEATURES = [
	"Gender",
	"Family_History",
	"Diabetes_Status",
]
FEATURE_COLUMNS = [
	"Age",
	"Gender",
	"BMI",
	"Resting_BP",
	"Serum_Cholesterol",
	"Fasting_Blood_Sugar",
	"Max_Heart_Rate",
	"ST_Depression_Oldpeak",
	"Ejection_Fraction",
	"Troponin_Level",
	"BNP_Level",
	"CRP_Level",
	"WBC_Count",
	"HRV_SDNN",
	"Resting_Respiratory_Rate",
	"SpO2",
	"Triglycerides",
	"LDL_Cholesterol",
	"HDL_Cholesterol",
	"Cigarettes_Per_Day",
	"Family_History",
	"Diabetes_Status",
	"Alcohol_ml_Per_Day",
]


def load_class_metadata(dataset_path: Path = DATASET_PATH) -> tuple[list[int], dict[str, str]]:
	"""Return sorted class values and their dataset-provided labels."""
	dataframe = pd.read_csv(dataset_path, usecols=[TARGET_COLUMN, DESCRIPTIVE_TARGET_COLUMN])
	class_pairs = dataframe.drop_duplicates().sort_values(TARGET_COLUMN)
	class_values = [int(value) for value in class_pairs[TARGET_COLUMN]]
	class_labels = {
		str(index): str(label)
		for index, label in enumerate(class_pairs[DESCRIPTIVE_TARGET_COLUMN])
	}
	return class_values, class_labels
NUMERICAL_FEATURES = [
	"Age",
	"BMI",
	"Resting_BP",
	"Serum_Cholesterol",
	"Fasting_Blood_Sugar",
	"Max_Heart_Rate",
	"ST_Depression_Oldpeak",
	"Ejection_Fraction",
	"Troponin_Level",
	"BNP_Level",
	"CRP_Level",
	"WBC_Count",
	"HRV_SDNN",
	"Resting_Respiratory_Rate",
	"SpO2",
	"Triglycerides",
	"LDL_Cholesterol",
	"HDL_Cholesterol",
	"Cigarettes_Per_Day",
	"Alcohol_ml_Per_Day",
]


def load_and_split_data(
	dataset_path: Path = DATASET_PATH,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
	"""Load the original CSV, separate features and target, and make three splits."""
	dataframe = pd.read_csv(dataset_path)

	# Remove only the identifier and descriptive label; no clinical feature is removed.
	drop_columns = [DESCRIPTIVE_TARGET_COLUMN]
	if IDENTIFIER_COLUMN is not None:
		drop_columns.append(IDENTIFIER_COLUMN)
	model_dataframe = dataframe.drop(columns=drop_columns)
	X = model_dataframe.drop(columns=[TARGET_COLUMN])
	class_values = sorted(model_dataframe[TARGET_COLUMN].unique())
	class_index = {value: index for index, value in enumerate(class_values)}
	y = model_dataframe[TARGET_COLUMN].map(class_index).astype(int)

	# First reserve 20% for validation and testing while preserving class ratios.
	X_train, X_remaining, y_train, y_remaining = train_test_split(
		X,
		y,
		test_size=0.2,
		random_state=RANDOM_STATE,
		stratify=y,
	)

	# Divide the reserved 20% equally into validation and test sets.
	X_validation, X_test, y_validation, y_test = train_test_split(
		X_remaining,
		y_remaining,
		test_size=0.5,
		random_state=RANDOM_STATE,
		stratify=y_remaining,
	)

	return X_train, X_validation, X_test, y_train, y_validation, y_test


def create_preprocessor() -> ColumnTransformer:
	"""Create the feature transformer used for every dataset split."""
	return ColumnTransformer(
		transformers=[
			(
				"numerical",
				MinMaxScaler(),
				NUMERICAL_FEATURES,
			),
			(
				"categorical",
				OneHotEncoder(handle_unknown="ignore", sparse_output=False),
				CATEGORICAL_FEATURES,
			),
		],
		remainder="drop",
	)


def preprocess_data(
	X_train: pd.DataFrame,
	X_validation: pd.DataFrame,
	X_test: pd.DataFrame,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, ColumnTransformer]:
	"""Fit preprocessing on training data and transform all three splits.

	The transformer must learn category levels and numerical ranges from training
	data only. Fitting on validation or test data would leak information from
	those evaluation sets into the training pipeline.
	"""
	preprocessor = create_preprocessor()

	# Fit once on training data. Validation and test data are transformed only.
	X_train_transformed = preprocessor.fit_transform(X_train)
	X_validation_transformed = preprocessor.transform(X_validation)
	X_test_transformed = preprocessor.transform(X_test)

	return (
		X_train_transformed,
		X_validation_transformed,
		X_test_transformed,
		preprocessor,
	)


def verify_preprocessed_data(
	X_train_transformed: np.ndarray,
	X_validation_transformed: np.ndarray,
	X_test_transformed: np.ndarray,
	preprocessor: ColumnTransformer,
) -> None:
	"""Verify transformed sizes, finite values, scaling, and shared transformer use."""
	transformed_splits = (
		X_train_transformed,
		X_validation_transformed,
		X_test_transformed,
	)
	expected_sample_counts = (10_400, 1_300, 1_300)

	if tuple(split.shape[0] for split in transformed_splits) != expected_sample_counts:
		raise ValueError("Transformed sample counts do not match the original splits.")
	if any(np.isnan(split).any() for split in transformed_splits):
		raise ValueError("NaN values found after preprocessing.")
	if any(np.isinf(split).any() for split in transformed_splits):
		raise ValueError("Infinite values found after preprocessing.")

	# The numerical transformer is the first branch, so its output occupies the
	# first numerical feature columns of each dense transformed array.
	numerical_width = len(NUMERICAL_FEATURES)
	min_max_tolerance = 1e-9
	for split in transformed_splits:
		numerical_values = split[:, :numerical_width]
		if not (
			(numerical_values >= -min_max_tolerance)
			& (numerical_values <= 1.0 + min_max_tolerance)
		).all():
			raise ValueError("Scaled numerical values fall outside the [0, 1] range.")

	if not hasattr(preprocessor, "transformers_"):
		raise ValueError("The preprocessing transformer has not been fitted.")

	print("\nPreprocessed sample counts: PASS")
	print("NaN check: PASS")
	print("Infinite-value check: PASS")
	print("Numerical Min-Max range check [0, 1]: PASS")
	print("Shared fitted transformer check: PASS")


def print_preprocessing_report(
	X_train: pd.DataFrame,
	X_train_transformed: np.ndarray,
	X_validation_transformed: np.ndarray,
	X_test_transformed: np.ndarray,
	preprocessor: ColumnTransformer,
) -> None:
	"""Print the final preprocessing summary and generated feature names."""
	feature_names = preprocessor.get_feature_names_out()

	print("\n" + "=" * 80)
	print("PREPROCESSING REPORT")
	print("=" * 80)
	print(f"Original feature count: {X_train.shape[1]}")
	print(f"Number of numerical features: {len(NUMERICAL_FEATURES)}")
	print(f"Number of categorical features: {len(CATEGORICAL_FEATURES)}")
	print(f"Transformed training shape: {X_train_transformed.shape}")
	print(f"Transformed validation shape: {X_validation_transformed.shape}")
	print(f"Transformed test shape: {X_test_transformed.shape}")
	print(f"Generated encoded/transformed feature count: {len(feature_names)}")
	print("Generated feature names:")
	print(list(feature_names))


def print_split_report(
	X_train: pd.DataFrame,
	X_validation: pd.DataFrame,
	X_test: pd.DataFrame,
	y_train: pd.Series,
	y_validation: pd.Series,
	y_test: pd.Series,
) -> None:
	"""Print split shapes, target counts, and target percentages."""
	print("\n" + "=" * 80)
	print("TRAIN / VALIDATION / TEST SPLIT REPORT")
	print("=" * 80)
	print(f"X_train shape: {X_train.shape}")
	print(f"X_validation shape: {X_validation.shape}")
	print(f"X_test shape: {X_test.shape}")
	print(f"y_train shape: {y_train.shape}")
	print(f"y_validation shape: {y_validation.shape}")
	print(f"y_test shape: {y_test.shape}")

	for split_name, target in (
		("Training", y_train),
		("Validation", y_validation),
		("Testing", y_test),
	):
		print(f"\n{split_name} target class counts:")
		print(target.value_counts().sort_index())
		print(f"{split_name} target class percentages:")
		print((target.value_counts(normalize=True).sort_index() * 100).round(2))


def verify_split_distribution(
	X_train: pd.DataFrame,
	X_validation: pd.DataFrame,
	X_test: pd.DataFrame,
	y_train: pd.Series,
	y_validation: pd.Series,
	y_test: pd.Series,
) -> None:
	"""Verify sizes, coverage, disjointness, and stratified class proportions."""
	split_features = (X_train, X_validation, X_test)
	split_targets = (y_train, y_validation, y_test)
	split_names = ("training", "validation", "test")
	expected_sizes = (10_400, 1_300, 1_300)

	print("\n" + "=" * 80)
	print("SPLIT VERIFICATION")
	print("=" * 80)

	actual_sizes = tuple(len(target) for target in split_targets)
	if actual_sizes != expected_sizes:
		raise ValueError(f"Unexpected split sizes: {actual_sizes}; expected {expected_sizes}.")
	print(f"Total samples after splitting: {sum(actual_sizes)}")
	print("Sample counts: PASS (10,400 training, 1,300 validation, 1,300 test)")

	index_sets = [set(features.index) for features in split_features]
	union_size = len(set.union(*index_sets))
	total_split_samples = sum(len(index_set) for index_set in index_sets)
	no_overlap = all(
		index_sets[first].isdisjoint(index_sets[second])
		for first in range(len(index_sets))
		for second in range(first + 1, len(index_sets))
	)
	no_sample_lost = union_size == 13_000 and total_split_samples == union_size
	if not no_sample_lost:
		raise ValueError("The splits do not contain all 13,000 unique original samples.")
	print("No sample lost: PASS")
	if not no_overlap:
		raise ValueError("At least one sample appears in more than one split.")
	print("No sample appears in more than one split: PASS")

	all_classes = set(y_train.unique()) | set(y_validation.unique()) | set(y_test.unique())
	if not all_classes or any(set(target.unique()) != all_classes for target in split_targets):
		raise ValueError("All target classes are not present in every split.")
	print(f"All target classes present in every split: PASS ({sorted(all_classes)})")

	overall_percentages = pd.concat(split_targets).value_counts(normalize=True).sort_index()
	proportions_match = True
	for split_name, target in zip(split_names, split_targets):
		split_percentages = target.value_counts(normalize=True).sort_index()
		if not split_percentages.index.equals(overall_percentages.index) or not (
			(split_percentages - overall_percentages).abs() <= 0.01
		).all():
			proportions_match = False
		print(
			f"{split_name.capitalize()} class proportions within 1 percentage point "
			f"of overall: {'PASS' if proportions_match else 'FAIL'}"
		)
	if not proportions_match:
		raise ValueError("Class proportions are not approximately equal across splits.")


def main() -> None:
	"""Run dataset splitting and Step 4 feature preprocessing."""
	splits = load_and_split_data()
	print_split_report(*splits)
	verify_split_distribution(*splits)

	X_train, X_validation, X_test, _, _, _ = splits
	transformed_splits = preprocess_data(X_train, X_validation, X_test)
	X_train_transformed, X_validation_transformed, X_test_transformed, preprocessor = transformed_splits
	verify_preprocessed_data(
		X_train_transformed,
		X_validation_transformed,
		X_test_transformed,
		preprocessor,
	)
	print_preprocessing_report(
		X_train,
		X_train_transformed,
		X_validation_transformed,
		X_test_transformed,
		preprocessor,
	)


if __name__ == "__main__":
	main()
