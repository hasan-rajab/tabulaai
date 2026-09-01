from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import roc_auc_score

from falcon.features import FEATURE_NAMES
from falcon.models import fit_bundle
from falcon.monitoring import FalconMonitor
from falcon.storage import DecisionStore
from falcon.training import build_training_profile
from forgeml.registry import ModelRegistry
from forgeml.tracking import ExperimentTracker


class RetrainingAdvisor:
    def __init__(self, state_dir: str | Path):
        self.monitor = FalconMonitor(state_dir)

    def recommend(self) -> dict[str, Any]:
        snapshot = self.monitor.snapshot()
        drift = snapshot["drift"]
        perf = snapshot["experiment"]
        challenger = perf.get("challenger") or {}
        champion = perf.get("champion") or {}

        if drift.get("sample_count", 0) >= 100 and drift.get("max_psi", 0.0) >= 0.20:
            return {"action": "retrain", "reason": "feature_drift", "evidence": snapshot}
        if (
            perf.get("labeled_count", 0) >= 100
            and challenger.get("sample_count", 0) >= 50
            and "brier" in challenger
            and "brier" in champion
            and challenger["brier"] <= champion["brier"] - 0.015
        ):
            return {"action": "promote_challenger", "reason": "challenger_brier_improvement", "evidence": snapshot}
        if perf.get("labeled_count", 0) >= 100 and champion.get("brier", 0.0) >= 0.25:
            return {"action": "retrain", "reason": "champion_performance_degradation", "evidence": snapshot}
        return {"action": "hold", "reason": "no_release_trigger", "evidence": snapshot}


def retrain_from_feedback(
    state_dir: str | Path,
    *,
    min_labels: int = 200,
    seed: int = 91,
) -> dict[str, Any]:
    root = Path(state_dir)
    store = DecisionStore(root / "falcon.db")
    rows = store.labeled_rows(limit=20_000)
    if len(rows) < min_labels:
        raise ValueError(f"Need at least {min_labels} labeled decisions for retraining")

    x = np.asarray(
        [[float(row["features"][name]) for name in FEATURE_NAMES] for row in rows],
        dtype=np.float64,
    )
    y = np.asarray([int(row["is_fraud"]) for row in rows], dtype=np.int64)
    if len(np.unique(y)) < 2:
        raise ValueError("Feedback must contain both fraud and non-fraud outcomes")

    split = max(1, int(len(x) * 0.80))
    if split >= len(x):
        split = len(x) - 1
    x_train, x_test = x[:split], x[split:]
    y_train, y_test = y[:split], y[split:]
    if len(np.unique(y_test)) < 2:
        # Deterministic alternating holdout fallback for small/ordered feedback.
        test_mask = np.arange(len(x)) % 5 == 0
        train_mask = ~test_mask
        x_train, x_test = x[train_mask], x[test_mask]
        y_train, y_test = y[train_mask], y[test_mask]
    if len(np.unique(y_train)) < 2 or len(np.unique(y_test)) < 2:
        raise ValueError("Feedback split must contain both classes in train and validation data")

    fingerprint = hashlib.sha256(
        np.ascontiguousarray(x).tobytes() + np.ascontiguousarray(y).tobytes()
    ).hexdigest()
    tracker = ExperimentTracker(root / "experiments.db")
    registry = ModelRegistry(root / "registry")
    run_id = tracker.start_run(
        model_name="falcon-risk",
        task="feedback_retraining",
        data_fingerprint=fingerprint,
        params={"rows": len(rows), "seed": seed, "source": "production_feedback"},
    )
    artifact_dir = root / "run_artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / f"{run_id}.joblib"

    try:
        bundle = fit_bundle(
            x_train,
            y_train,
            profile=build_training_profile(x_train),
            model_label="feedback_challenger",
            seed=seed,
            challenger=True,
        )
        auc = float(roc_auc_score(y_test, bundle.classifier.predict_proba(x_test)[:, 1]))
        joblib.dump(bundle, artifact_path)
        registered = registry.register(
            model_name="falcon-risk",
            run_id=run_id,
            source_artifact=artifact_path,
            metric_name="roc_auc",
            metric_value=auc,
            metadata={
                "synthetic_training": False,
                "feedback_training": True,
                "rows": len(rows),
                "feature_names": FEATURE_NAMES,
            },
            stage="candidate",
        )
        tracker.complete_run(run_id, metric_name="roc_auc", metric_value=auc, artifact_uri=registered["artifact_uri"])
        return registered
    except Exception as exc:
        tracker.fail_run(run_id, str(exc))
        raise
