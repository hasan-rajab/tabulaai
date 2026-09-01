from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


class ExperimentTracker:
    """Small durable experiment tracker backed by SQLite."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS experiment_runs (
              run_id TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              model_name TEXT NOT NULL,
              task TEXT NOT NULL,
              data_fingerprint TEXT NOT NULL,
              params_json TEXT NOT NULL,
              metric_name TEXT,
              metric_value REAL,
              artifact_uri TEXT,
              error TEXT,
              created_at TEXT NOT NULL,
              finished_at TEXT
            )
            """
        )
        self._connection.commit()

    def start_run(
        self,
        *,
        model_name: str,
        task: str,
        data_fingerprint: str,
        params: dict[str, Any],
    ) -> str:
        run_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO experiment_runs
                (run_id, status, model_name, task, data_fingerprint, params_json, created_at)
                VALUES (?, 'running', ?, ?, ?, ?, ?)
                """,
                (run_id, model_name, task, data_fingerprint, json.dumps(params, sort_keys=True), now),
            )
            self._connection.commit()
        return run_id

    def complete_run(
        self,
        run_id: str,
        *,
        metric_name: str,
        metric_value: float,
        artifact_uri: str,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._connection.execute(
                """
                UPDATE experiment_runs
                SET status='completed', metric_name=?, metric_value=?, artifact_uri=?, finished_at=?
                WHERE run_id=?
                """,
                (metric_name, float(metric_value), artifact_uri, now, run_id),
            )
            self._connection.commit()

    def fail_run(self, run_id: str, error: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._connection.execute(
                """
                UPDATE experiment_runs
                SET status='failed', error=?, finished_at=?
                WHERE run_id=?
                """,
                (error[:4000], now, run_id),
            )
            self._connection.commit()

    def get(self, run_id: str) -> dict[str, Any]:
        row = self._connection.execute(
            "SELECT * FROM experiment_runs WHERE run_id=?", (run_id,)
        ).fetchone()
        if row is None:
            raise KeyError(run_id)
        return self._row(row)

    def list_runs(self, model_name: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if model_name:
            rows = self._connection.execute(
                "SELECT * FROM experiment_runs WHERE model_name=? ORDER BY created_at DESC LIMIT ?",
                (model_name, limit),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT * FROM experiment_runs ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row(row) for row in rows]

    @staticmethod
    def _row(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["params"] = json.loads(data.pop("params_json"))
        return data
