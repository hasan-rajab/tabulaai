from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from falcon.schema import FeedbackEvent, RiskDecision


class DecisionStore:
    """Durable ledger for decisions, online features, feedback and A/B state."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS decisions (
              transaction_id TEXT PRIMARY KEY,
              decision TEXT NOT NULL,
              risk_score REAL NOT NULL,
              supervised_score REAL NOT NULL,
              anomaly_score REAL NOT NULL,
              model_version INTEGER NOT NULL,
              model_role TEXT NOT NULL,
              champion_score REAL NOT NULL,
              challenger_score REAL,
              experiment_bucket INTEGER,
              reasons_json TEXT NOT NULL,
              features_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS feedback (
              transaction_id TEXT PRIMARY KEY,
              is_fraud INTEGER NOT NULL,
              outcome TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(transaction_id) REFERENCES decisions(transaction_id)
            );
            CREATE TABLE IF NOT EXISTS experiment_config (
              singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
              challenger_version INTEGER,
              traffic_percent INTEGER NOT NULL,
              mode TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            INSERT OR IGNORE INTO experiment_config
              (singleton, challenger_version, traffic_percent, mode, updated_at)
              VALUES (1, NULL, 0, 'shadow', '1970-01-01T00:00:00+00:00');
            """
        )
        self._connection.commit()

    def get_decision(self, transaction_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM decisions WHERE transaction_id=?", (transaction_id,)
        ).fetchone()
        return self._decision_row(row) if row else None

    def save_decision(self, decision: RiskDecision, features: dict[str, float]) -> dict[str, Any]:
        payload = decision.model_dump(mode="json")
        with self._lock:
            self._connection.execute(
                """
                INSERT OR IGNORE INTO decisions
                (transaction_id, decision, risk_score, supervised_score, anomaly_score,
                 model_version, model_role, champion_score, challenger_score,
                 experiment_bucket, reasons_json, features_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    decision.transaction_id,
                    decision.decision,
                    decision.risk_score,
                    decision.supervised_score,
                    decision.anomaly_score,
                    decision.model_version,
                    decision.model_role,
                    decision.champion_score,
                    decision.challenger_score,
                    decision.experiment_bucket,
                    json.dumps(decision.reasons, sort_keys=True),
                    json.dumps(features, sort_keys=True),
                    decision.created_at.isoformat(),
                ),
            )
            self._connection.commit()
        stored = self.get_decision(decision.transaction_id)
        if stored is None:
            raise RuntimeError("Decision persistence failed")
        return stored

    def record_feedback(self, feedback: FeedbackEvent) -> dict[str, Any]:
        if self.get_decision(feedback.transaction_id) is None:
            raise KeyError(feedback.transaction_id)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO feedback(transaction_id, is_fraud, outcome, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(transaction_id) DO UPDATE SET
                  is_fraud=excluded.is_fraud,
                  outcome=excluded.outcome,
                  created_at=excluded.created_at
                """,
                (feedback.transaction_id, int(feedback.is_fraud), feedback.outcome, now),
            )
            self._connection.commit()
        return {"transaction_id": feedback.transaction_id, "is_fraud": feedback.is_fraud, "outcome": feedback.outcome}

    def set_experiment(self, challenger_version: int | None, traffic_percent: int, mode: str) -> dict[str, Any]:
        if not 0 <= traffic_percent <= 100:
            raise ValueError("traffic_percent must be between 0 and 100")
        if mode not in {"shadow", "active"}:
            raise ValueError("mode must be shadow or active")
        if traffic_percent and challenger_version is None:
            raise ValueError("challenger_version is required when traffic is enabled")
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._connection.execute(
                """
                UPDATE experiment_config
                SET challenger_version=?, traffic_percent=?, mode=?, updated_at=?
                WHERE singleton=1
                """,
                (challenger_version, traffic_percent, mode, now),
            )
            self._connection.commit()
        return self.get_experiment()

    def get_experiment(self) -> dict[str, Any]:
        row = self._connection.execute(
            "SELECT challenger_version, traffic_percent, mode, updated_at FROM experiment_config WHERE singleton=1"
        ).fetchone()
        return dict(row)

    def recent_decisions(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [self._decision_row(row) for row in rows]

    def recent_feature_rows(self, limit: int = 1000) -> list[dict[str, float]]:
        rows = self._connection.execute(
            "SELECT features_json FROM decisions ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [json.loads(row["features_json"]) for row in rows]

    def labeled_rows(self, limit: int = 5000) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            """
            SELECT d.*, f.is_fraud, f.outcome
            FROM decisions d JOIN feedback f USING(transaction_id)
            ORDER BY f.created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
        result = []
        for row in rows:
            item = self._decision_row(row)
            item["is_fraud"] = bool(row["is_fraud"])
            item["outcome"] = row["outcome"]
            result.append(item)
        return result

    @staticmethod
    def _decision_row(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["reasons"] = json.loads(data.pop("reasons_json"))
        data["features"] = json.loads(data.pop("features_json"))
        return data
