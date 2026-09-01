from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score

from falcon.storage import DecisionStore
from forgeml.registry import ModelRegistry


def _psi(reference: list[float], current: np.ndarray) -> float:
    ref = np.asarray(reference, dtype=np.float64)
    cur = np.asarray(current, dtype=np.float64)
    ref = np.clip(ref, 1e-6, None)
    cur = np.clip(cur, 1e-6, None)
    ref = ref / ref.sum()
    cur = cur / cur.sum()
    return float(np.sum((cur - ref) * np.log(cur / ref)))


class FalconMonitor:
    def __init__(self, state_dir: str | Path):
        self.root = Path(state_dir)
        self.registry = ModelRegistry(self.root / "registry")
        self.store = DecisionStore(self.root / "falcon.db")

    def feature_drift(self, limit: int = 1000, threshold: float = 0.20) -> dict[str, Any]:
        rows = self.store.recent_feature_rows(limit=limit)
        if not rows:
            return {"sample_count": 0, "max_psi": 0.0, "drifted_features": [], "features": {}}
        champion = self.registry.resolve("falcon-risk", "production")
        bundle = joblib.load(champion["artifact_uri"])
        feature_metrics: dict[str, float] = {}
        for name, profile in bundle.training_profile.items():
            values = np.asarray([float(row[name]) for row in rows], dtype=np.float64)
            bins = np.asarray(profile["bins"], dtype=np.float64)
            if len(bins) < 2:
                continue
            counts, _ = np.histogram(values, bins=bins)
            proportions = (counts / max(1, counts.sum())).tolist()
            feature_metrics[name] = _psi(profile["proportions"], proportions)
        drifted = sorted(name for name, value in feature_metrics.items() if value >= threshold)
        return {
            "sample_count": len(rows),
            "max_psi": max(feature_metrics.values(), default=0.0),
            "drifted_features": drifted,
            "features": feature_metrics,
            "threshold": threshold,
        }

    def experiment_performance(self, limit: int = 5000) -> dict[str, Any]:
        rows = self.store.labeled_rows(limit=limit)
        if not rows:
            return {"labeled_count": 0, "champion": {}, "challenger": {}}
        y = np.asarray([int(row["is_fraud"]) for row in rows], dtype=np.int64)
        champion_scores = np.asarray([float(row["champion_score"]) for row in rows], dtype=np.float64)
        challenger_rows = [row for row in rows if row["challenger_score"] is not None]

        champion_metrics: dict[str, float] = {
            "brier": float(brier_score_loss(y, champion_scores)),
        }
        if len(np.unique(y)) > 1:
            champion_metrics["roc_auc"] = float(roc_auc_score(y, champion_scores))

        challenger_metrics: dict[str, float] = {}
        if challenger_rows:
            cy = np.asarray([int(row["is_fraud"]) for row in challenger_rows], dtype=np.int64)
            cs = np.asarray([float(row["challenger_score"]) for row in challenger_rows], dtype=np.float64)
            challenger_metrics["sample_count"] = float(len(challenger_rows))
            challenger_metrics["brier"] = float(brier_score_loss(cy, cs))
            if len(np.unique(cy)) > 1:
                challenger_metrics["roc_auc"] = float(roc_auc_score(cy, cs))

        decision_mix = Counter(row["decision"] for row in rows)
        return {
            "labeled_count": len(rows),
            "champion": champion_metrics,
            "challenger": challenger_metrics,
            "decision_mix": dict(decision_mix),
        }

    def snapshot(self) -> dict[str, Any]:
        return {
            "drift": self.feature_drift(),
            "experiment": self.experiment_performance(),
            "config": self.store.get_experiment(),
        }
