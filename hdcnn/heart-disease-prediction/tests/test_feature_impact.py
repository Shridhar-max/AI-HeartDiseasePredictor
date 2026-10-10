import unittest

import pandas as pd

from ml.predict import EXPECTED_INPUT_FEATURES, _load_artifacts, predict_patient


class PredictionFeatureImpactTests(unittest.TestCase):
    def test_prediction_includes_class_specific_impact_analysis(self):
        patient = pd.read_csv(
            "data/heart_disease_dataset_13k.csv"
        ).iloc[0].dropna().to_dict()
        patient.pop("Diagnosis_Class", None)
        patient.pop("Diagnosis_Label", None)

        result = predict_patient(patient)

        self.assertIn("affected_attributes", result)
        self.assertIn("impact_graph", result)
        self.assertGreater(len(result["affected_attributes"]), 0)
        self.assertEqual(
            len(result["affected_attributes"]),
            len(result["impact_graph"]["items"]),
        )
        for attribute in result["affected_attributes"]:
            self.assertIn("feature", attribute)
            self.assertIn("impact_score", attribute)
            self.assertIn("impact_level", attribute)
            self.assertIn("direction", attribute)
            self.assertGreaterEqual(attribute["impact_score"], 0)
            self.assertLessEqual(attribute["impact_score"], 1)

    def test_top_influenced_attributes_are_specific_to_predicted_disease(self):
        dataset = pd.read_csv("data/heart_disease_dataset_13k.csv")
        model, preprocessor, class_labels = _load_artifacts()
        patient_features = dataset[list(EXPECTED_INPUT_FEATURES)]
        model_input = preprocessor.transform(patient_features).astype("float32")
        probabilities = model.predict(
            model_input.reshape(len(model_input), len(EXPECTED_INPUT_FEATURES), 1),
            batch_size=256,
            verbose=0,
        )
        predicted_classes = probabilities.argmax(axis=1)

        top_features = {}
        for class_id in (3, 6):
            row_index = int((predicted_classes == class_id).argmax())
            patient = patient_features.iloc[row_index].to_dict()
            result = predict_patient(patient)
            self.assertEqual(result["predicted_class"], class_id)
            self.assertEqual(result["predicted_label"], class_labels[str(class_id)])
            top_features[class_id] = result["affected_attributes"][0]["feature"]

        self.assertEqual(top_features[3], "Troponin_Level")
        self.assertEqual(top_features[6], "CRP_Level")


if __name__ == "__main__":
    unittest.main()
