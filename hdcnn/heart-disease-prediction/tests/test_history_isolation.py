import tempfile
import unittest
from pathlib import Path

import backend.history as history


class PredictionHistoryIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "test_history.sqlite3"
        history.DATABASE_PATH = self.database_path

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_each_owner_only_sees_their_own_records(self):
        first = history.save_prediction_records(
            "first.csv",
            [{
                "Prediction_Class": 1,
                "Prediction_Label": "First",
                "Prediction_Confidence": 80.0,
                "Prediction_Status": "Success",
            }],
            "model",
            "CSV",
            "2026-01-01T00:00:00+00:00",
            "alice@example.com",
        )[0]
        history.save_prediction_records(
            "second.csv",
            [{
                "Prediction_Class": 2,
                "Prediction_Label": "Second",
                "Prediction_Confidence": 90.0,
                "Prediction_Status": "Success",
            }],
            "model",
            "CSV",
            "2026-01-02T00:00:00+00:00",
            "bob@example.com",
        )

        alice_records = history.list_prediction_records("alice@example.com")
        bob_records = history.list_prediction_records("bob@example.com")

        self.assertEqual([record["id"] for record in alice_records], [first["id"]])
        self.assertEqual(len(bob_records), 1)
        self.assertNotEqual(alice_records[0]["id"], bob_records[0]["id"])

    def test_owner_cannot_delete_or_clear_another_owner_record(self):
        record = history.save_prediction_records(
            "shared.csv",
            [{
                "Prediction_Class": 1,
                "Prediction_Label": "Shared",
                "Prediction_Confidence": 80.0,
                "Prediction_Status": "Success",
            }],
            "model",
            "CSV",
            "2026-01-01T00:00:00+00:00",
            "alice@example.com",
        )[0]

        self.assertFalse(history.delete_prediction_record(record["id"], "bob@example.com"))
        self.assertEqual(len(history.list_prediction_records("alice@example.com")), 1)

        history.clear_prediction_records("bob@example.com")
        self.assertEqual(len(history.list_prediction_records("alice@example.com")), 1)


if __name__ == "__main__":
    unittest.main()
