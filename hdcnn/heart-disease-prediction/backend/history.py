"""Persistent prediction history storage backed by SQLite."""

import json
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = PROJECT_ROOT / "backend" / "prediction_history.sqlite3"


def _connect() -> sqlite3.Connection:
	connection = sqlite3.connect(DATABASE_PATH)
	connection.row_factory = sqlite3.Row
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS prediction_history (
			id TEXT PRIMARY KEY,
			owner_email TEXT NOT NULL,
			uploaded_file_name TEXT NOT NULL,
			record_index INTEGER NOT NULL,
			input_attributes TEXT NOT NULL,
			prediction_class INTEGER NOT NULL,
			prediction_label TEXT NOT NULL,
			prediction_confidence REAL NOT NULL,
			prediction_timestamp TEXT NOT NULL,
			model_name TEXT NOT NULL,
			prediction_type TEXT NOT NULL
		)
		"""
	)
	columns = {
		row["name"]
		for row in connection.execute("PRAGMA table_info(prediction_history)")
	}
	if "owner_email" not in columns:
		connection.execute(
			"ALTER TABLE prediction_history ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''"
		)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_prediction_history_owner_email ON prediction_history(owner_email)"
	)
	connection.commit()
	return connection


def save_prediction_records(
	filename: str,
	results: list[dict[str, Any]],
	model_name: str,
	prediction_type: str,
	timestamp: str,
	owner_email: str,
) -> list[dict[str, Any]]:
	"""Persist one history row for every successful prediction owned by one user."""
	normalized_owner = owner_email.strip().lower()
	if not normalized_owner or "@" not in normalized_owner:
		raise ValueError("A valid owner email is required.")
	saved_records: list[dict[str, Any]] = []
	with closing(_connect()) as connection:
		for record_index, result in enumerate(results, start=1):
			record_id = str(uuid.uuid4())
			input_attributes = {
				key: value
				for key, value in result.items()
				if key not in {"Prediction_Class", "Prediction_Label", "Prediction_Confidence", "Prediction_Status"}
			}
			record = {
				"id": record_id,
				"owner_email": normalized_owner,
				"uploaded_file_name": filename,
				"record_index": record_index,
				"all_23_input_attributes": input_attributes,
				"prediction_class": int(result["Prediction_Class"]),
				"prediction_label": str(result["Prediction_Label"]),
				"prediction_confidence": float(result["Prediction_Confidence"]),
				"prediction_timestamp": timestamp,
				"model_name": model_name,
				"prediction_type": prediction_type,
			}
			connection.execute(
				"""
				INSERT INTO prediction_history (
					id, owner_email, uploaded_file_name, record_index, input_attributes,
					prediction_class, prediction_label, prediction_confidence,
					prediction_timestamp, model_name, prediction_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				""",
				(
					record_id,
					normalized_owner,
					filename,
					record_index,
					json.dumps(input_attributes),
					record["prediction_class"],
					record["prediction_label"],
					record["prediction_confidence"],
					timestamp,
					model_name,
					prediction_type,
				),
			)
			saved_records.append(record)
		connection.commit()
	return saved_records


def list_prediction_records(owner_email: str) -> list[dict[str, Any]]:
	"""Return only the owner's saved records, newest first."""
	normalized_owner = owner_email.strip().lower()
	with closing(_connect()) as connection:
		rows = connection.execute(
			"""
			SELECT * FROM prediction_history
			WHERE owner_email = ?
			ORDER BY prediction_timestamp DESC, record_index DESC
			""",
			(normalized_owner,),
		).fetchall()
	return [
		{
			"id": row["id"],
			"owner_email": row["owner_email"],
			"uploaded_file_name": row["uploaded_file_name"],
			"record_index": row["record_index"],
			"all_23_input_attributes": json.loads(row["input_attributes"]),
			"prediction_class": row["prediction_class"],
			"prediction_label": row["prediction_label"],
			"prediction_confidence": row["prediction_confidence"],
			"prediction_timestamp": row["prediction_timestamp"],
			"model_name": row["model_name"],
			"prediction_type": row["prediction_type"],
		}
		for row in rows
	]


def delete_prediction_record(record_id: str, owner_email: str) -> bool:
	"""Delete one record only when it belongs to the requester."""
	normalized_owner = owner_email.strip().lower()
	with closing(_connect()) as connection:
		cursor = connection.execute(
			"DELETE FROM prediction_history WHERE id = ? AND owner_email = ?",
			(record_id, normalized_owner),
		)
		connection.commit()
	return cursor.rowcount > 0


def clear_prediction_records(owner_email: str) -> None:
	"""Delete only the requester's persisted prediction history."""
	normalized_owner = owner_email.strip().lower()
	with closing(_connect()) as connection:
		connection.execute(
			"DELETE FROM prediction_history WHERE owner_email = ?",
			(normalized_owner,),
		)
		connection.commit()
