from __future__ import annotations

import json
import shutil
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VALID_STAGES = {"candidate", "staging", "production", "archived"}


class ModelRegistry:
    """Versioned local model registry with explicit lifecycle stages."""

    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.artifact_root = self.root / "artifacts"
        self.artifact_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(self.root / "registry.db", check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS model_versions (
              model_name TEXT NOT NULL,
              version INTEGER NOT NULL,
              stage TEXT NOT NULL,
              run_id TEXT NOT NULL,
              artifact_uri TEXT NOT NULL,
              metric_name TEXT NOT NULL,
              metric_value REAL NOT NULL,
              metadata_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY(model_name, version)
            )
            """
        )
        self._connection.commit()

    def register(
        self,
        *,
        model_name: str,
        run_id: str,
        source_artifact: str | Path,
        metric_name: str,
        metric_value: float,
        metadata: dict[str, Any] | None = None,
        stage: str = "candidate",
    ) -> dict[str, Any]:
        if stage not in VALID_STAGES:
            raise ValueError(f"Invalid model stage: {stage}")
        source = Path(source_artifact)
        if not source.exists():
            raise FileNotFoundError(source)

        with self._lock:
            row = self._connection.execute(
                "SELECT COALESCE(MAX(version), 0) AS version FROM model_versions WHERE model_name=?",
                (model_name,),
            ).fetchone()
            version = int(row["version"]) + 1
            model_dir = self.artifact_root / model_name / f"v{version}"
            model_dir.mkdir(parents=True, exist_ok=False)
            destination = model_dir / "model.joblib"
            shutil.copy2(source, destination)
            created_at = datetime.now(timezone.utc).isoformat()
            self._connection.execute(
                """
                INSERT INTO model_versions
                (model_name, version, stage, run_id, artifact_uri, metric_name, metric_value, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    model_name,
                    version,
                    stage,
                    run_id,
                    str(destination.resolve()),
                    metric_name,
                    float(metric_value),
                    json.dumps(metadata or {}, sort_keys=True),
                    created_at,
                ),
            )
            self._connection.commit()
        return self.get(model_name, version)

    def promote(self, model_name: str, version: int, stage: str) -> dict[str, Any]:
        if stage not in VALID_STAGES:
            raise ValueError(f"Invalid model stage: {stage}")
        with self._lock:
            current = self._connection.execute(
                "SELECT 1 FROM model_versions WHERE model_name=? AND version=?",
                (model_name, version),
            ).fetchone()
            if current is None:
                raise KeyError((model_name, version))
            if stage == "production":
                self._connection.execute(
                    "UPDATE model_versions SET stage='archived' WHERE model_name=? AND stage='production'",
                    (model_name,),
                )
            self._connection.execute(
                "UPDATE model_versions SET stage=? WHERE model_name=? AND version=?",
                (stage, model_name, version),
            )
            self._connection.commit()
        return self.get(model_name, version)

    def get(self, model_name: str, version: int) -> dict[str, Any]:
        row = self._connection.execute(
            "SELECT * FROM model_versions WHERE model_name=? AND version=?",
            (model_name, version),
        ).fetchone()
        if row is None:
            raise KeyError((model_name, version))
        return self._row(row)

    def resolve(self, model_name: str, stage: str = "production") -> dict[str, Any]:
        row = self._connection.execute(
            """
            SELECT * FROM model_versions
            WHERE model_name=? AND stage=?
            ORDER BY version DESC LIMIT 1
            """,
            (model_name, stage),
        ).fetchone()
        if row is None:
            raise KeyError((model_name, stage))
        return self._row(row)

    def list_versions(self, model_name: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM model_versions WHERE model_name=? ORDER BY version DESC",
            (model_name,),
        ).fetchall()
        return [self._row(row) for row in rows]

    @staticmethod
    def _row(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["metadata"] = json.loads(data.pop("metadata_json"))
        return data
