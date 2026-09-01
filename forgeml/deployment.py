from __future__ import annotations

import hashlib
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class DeploymentManager:
    """Durable stable/canary deployment state with deterministic routing and rollback."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS deployments (
              model_name TEXT PRIMARY KEY,
              stable_version INTEGER NOT NULL,
              previous_stable_version INTEGER,
              challenger_version INTEGER,
              challenger_fraction REAL NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL
            )
            """
        )
        self._connection.commit()

    def set_stable(self, model_name: str, version: int) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            current = self._connection.execute(
                "SELECT * FROM deployments WHERE model_name=?", (model_name,)
            ).fetchone()
            previous = int(current["stable_version"]) if current else None
            self._connection.execute(
                """
                INSERT INTO deployments
                (model_name, stable_version, previous_stable_version, challenger_version, challenger_fraction, updated_at)
                VALUES (?, ?, ?, NULL, 0, ?)
                ON CONFLICT(model_name) DO UPDATE SET
                  previous_stable_version=deployments.stable_version,
                  stable_version=excluded.stable_version,
                  challenger_version=NULL,
                  challenger_fraction=0,
                  updated_at=excluded.updated_at
                """,
                (model_name, int(version), previous, now),
            )
            self._connection.commit()
        return self.current(model_name)

    def start_canary(self, model_name: str, challenger_version: int, fraction: float) -> dict[str, Any]:
        if not 0.0 < fraction < 1.0:
            raise ValueError("Canary fraction must be between 0 and 1")
        with self._lock:
            current = self._connection.execute(
                "SELECT * FROM deployments WHERE model_name=?", (model_name,)
            ).fetchone()
            if current is None:
                raise ValueError("A stable deployment is required before starting a canary")
            if int(current["stable_version"]) == int(challenger_version):
                raise ValueError("Challenger version must differ from the stable version")
            self._connection.execute(
                """
                UPDATE deployments
                SET challenger_version=?, challenger_fraction=?, updated_at=?
                WHERE model_name=?
                """,
                (
                    int(challenger_version),
                    float(fraction),
                    datetime.now(timezone.utc).isoformat(),
                    model_name,
                ),
            )
            self._connection.commit()
        return self.current(model_name)

    def route(self, model_name: str, request_id: str) -> int:
        state = self.current(model_name)
        challenger = state.get("challenger_version")
        fraction = float(state.get("challenger_fraction") or 0.0)
        if challenger is None or fraction <= 0:
            return int(state["stable_version"])
        bucket = int(hashlib.sha256(request_id.encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF
        return int(challenger) if bucket < fraction else int(state["stable_version"])

    def promote_canary(self, model_name: str) -> dict[str, Any]:
        with self._lock:
            current = self._connection.execute(
                "SELECT * FROM deployments WHERE model_name=?", (model_name,)
            ).fetchone()
            if current is None or current["challenger_version"] is None:
                raise ValueError("No active canary deployment")
            self._connection.execute(
                """
                UPDATE deployments
                SET previous_stable_version=stable_version,
                    stable_version=challenger_version,
                    challenger_version=NULL,
                    challenger_fraction=0,
                    updated_at=?
                WHERE model_name=?
                """,
                (datetime.now(timezone.utc).isoformat(), model_name),
            )
            self._connection.commit()
        return self.current(model_name)

    def rollback(self, model_name: str) -> dict[str, Any]:
        with self._lock:
            current = self._connection.execute(
                "SELECT * FROM deployments WHERE model_name=?", (model_name,)
            ).fetchone()
            if current is None:
                raise KeyError(model_name)
            previous = current["previous_stable_version"]
            if previous is None:
                raise ValueError("No previous stable deployment is available")
            current_stable = int(current["stable_version"])
            self._connection.execute(
                """
                UPDATE deployments
                SET stable_version=?, previous_stable_version=?,
                    challenger_version=NULL, challenger_fraction=0, updated_at=?
                WHERE model_name=?
                """,
                (
                    int(previous),
                    current_stable,
                    datetime.now(timezone.utc).isoformat(),
                    model_name,
                ),
            )
            self._connection.commit()
        return self.current(model_name)

    def current(self, model_name: str) -> dict[str, Any]:
        row = self._connection.execute(
            "SELECT * FROM deployments WHERE model_name=?", (model_name,)
        ).fetchone()
        if row is None:
            raise KeyError(model_name)
        return dict(row)
