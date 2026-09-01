from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.datasets import make_classification

from forgeml.deployment import DeploymentManager
from forgeml.monitoring import compute_drift
from forgeml.registry import ModelRegistry
from forgeml.retraining import RetrainingPolicy
from forgeml.tracking import ExperimentTracker
from forgeml.training import ForgeTrainer
from forgeml.validation import DatasetValidator


def _dataset(seed: int = 42, shift: float = 0.0) -> pd.DataFrame:
    X, y = make_classification(
        n_samples=220,
        n_features=6,
        n_informative=4,
        n_redundant=1,
        random_state=seed,
    )
    frame = pd.DataFrame(X, columns=[f"feature_{i}" for i in range(6)])
    frame["feature_0"] += shift
    frame["segment"] = np.where(frame["feature_1"] > 0, "enterprise", "smb")
    frame["target"] = y
    return frame


def _stack(tmp_path: Path):
    home = tmp_path / "forgeml"
    registry = ModelRegistry(home / "registry")
    tracker = ExperimentTracker(home / "experiments.db")
    deployments = DeploymentManager(home / "deployments.db")
    trainer = ForgeTrainer(
        workdir=home / "work",
        tracker=tracker,
        registry=registry,
    )
    return registry, tracker, deployments, trainer


def test_training_creates_tracked_registered_candidate(tmp_path: Path):
    registry, tracker, _, trainer = _stack(tmp_path)
    result = trainer.train(_dataset(), target="target", model_name="risk-model")

    assert result["version"] == 1
    assert result["stage"] == "candidate"
    assert result["metric_name"] == "f1_weighted"
    assert 0.0 <= result["metric_value"] <= 1.0
    assert len(result["data_fingerprint"]) == 64

    run = tracker.get(result["run_id"])
    version = registry.get("risk-model", 1)
    assert run["status"] == "completed"
    assert run["artifact_uri"] == version["artifact_uri"]
    assert Path(version["artifact_uri"]).exists()

    bundle = joblib.load(version["artifact_uri"])
    prediction = bundle["pipeline"].predict(_dataset().drop(columns=["target"]).head(1))[0]
    assert int(prediction) in {0, 1}


def test_canary_promotion_and_rollback_are_durable(tmp_path: Path):
    registry, _, deployments, trainer = _stack(tmp_path)
    first = trainer.train(_dataset(seed=1), target="target", model_name="risk-model")
    second = trainer.train(_dataset(seed=2), target="target", model_name="risk-model")

    registry.promote("risk-model", first["version"], "production")
    deployments.set_stable("risk-model", first["version"])
    registry.promote("risk-model", second["version"], "staging")
    deployments.start_canary("risk-model", second["version"], 0.25)

    routed = {deployments.route("risk-model", f"request-{i}") for i in range(300)}
    assert routed == {first["version"], second["version"]}

    registry.promote("risk-model", second["version"], "production")
    promoted = deployments.promote_canary("risk-model")
    assert promoted["stable_version"] == second["version"]
    assert promoted["previous_stable_version"] == first["version"]

    rolled_back = deployments.rollback("risk-model")
    registry.promote("risk-model", int(rolled_back["stable_version"]), "production")
    assert rolled_back["stable_version"] == first["version"]
    assert registry.resolve("risk-model", "production")["version"] == first["version"]


def test_drift_can_trigger_retraining_policy(tmp_path: Path):
    registry, _, _, trainer = _stack(tmp_path)
    result = trainer.train(_dataset(seed=3), target="target", model_name="risk-model")
    bundle = joblib.load(registry.get("risk-model", result["version"])["artifact_uri"])

    shifted = _dataset(seed=3, shift=12.0).drop(columns=["target"])
    report = compute_drift(bundle["reference_profile"], shifted, threshold=0.20)
    decision = RetrainingPolicy(drift_threshold=0.20).evaluate(drift_report=report)

    assert report["drift_detected"] is True
    assert "feature_0" in report["drifted_features"]
    assert decision.should_retrain is True
    assert decision.reasons


def test_performance_drop_can_trigger_retraining_without_feature_drift():
    decision = RetrainingPolicy(max_performance_drop=0.05).evaluate(
        baseline_metric=0.91,
        current_metric=0.82,
    )
    assert decision.should_retrain is True
    assert "performance drop" in decision.reasons[0]


def test_validator_rejects_invalid_training_contract():
    validator = DatasetValidator(min_rows=5)
    bad = pd.DataFrame({"x": [1, 2, 3, 4, 5], "target": [1, 1, 1, 1, 1]})
    report = validator.validate(bad, "target", "classification")
    assert report.valid is False
    assert any("at least two classes" in issue for issue in report.issues)

    with pytest.raises(ValueError, match="Target column"):
        validator.validate(bad, "missing_target")
