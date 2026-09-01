from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import roc_auc_score

from falcon.features import FEATURE_NAMES
from falcon.models import fit_bundle
from forgeml.registry import ModelRegistry
from forgeml.tracking import ExperimentTracker


def _sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-value))


def generate_synthetic_training_data(n: int = 2500, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate a deterministic, synthetic transaction-risk benchmark.

    This dataset is intentionally synthetic. It exists to exercise real-time
    ML system behavior and must not be presented as a production fraud dataset.
    """
    if n < 400:
        raise ValueError("Falcon training requires at least 400 synthetic rows")
    rng = np.random.default_rng(seed)
    amount = np.clip(rng.lognormal(mean=4.1, sigma=1.15, size=n), 0.5, 20_000.0)
    amount_log = np.log1p(amount)
    velocity_5m = np.clip(rng.poisson(0.8, size=n), 0, 15)
    velocity_1h = velocity_5m + np.clip(rng.poisson(2.2, size=n), 0, 30)
    amount_1h = amount * np.clip(velocity_1h + rng.uniform(0.4, 2.5, size=n), 0.5, 35)
    amount_zscore = np.clip(rng.normal(0.4, 1.6, size=n), -5, 10)
    new_device = rng.binomial(1, 0.16, size=n)
    country_changed = rng.binomial(1, 0.08, size=n)
    night_hour = rng.binomial(1, 0.18, size=n)
    merchant_risk = np.clip(rng.beta(1.8, 4.0, size=n), 0.02, 0.95)
    card_not_present = rng.binomial(1, 0.57, size=n)
    device_accounts = np.clip(rng.poisson(0.5, size=n), 0, 12)

    x = np.column_stack(
        [
            amount,
            amount_log,
            velocity_5m,
            velocity_1h,
            amount_1h,
            amount_zscore,
            new_device,
            country_changed,
            night_hour,
            merchant_risk,
            card_not_present,
            device_accounts,
        ]
    ).astype(np.float64)

    logit = (
        -5.2
        + 0.34 * np.clip(amount_zscore, 0, None)
        + 0.22 * velocity_5m
        + 0.08 * velocity_1h
        + 1.25 * new_device
        + 1.45 * country_changed
        + 0.55 * night_hour
        + 2.9 * merchant_risk
        + 0.55 * card_not_present
        + 0.28 * device_accounts
        + 0.000075 * np.clip(amount - 500.0, 0, None)
    )
    probability = _sigmoid(logit)
    y = rng.binomial(1, probability).astype(np.int64)
    if len(np.unique(y)) < 2:
        raise RuntimeError("Synthetic generator produced a degenerate target")
    return x, y


def build_training_profile(x: np.ndarray) -> dict[str, dict[str, Any]]:
    profile: dict[str, dict[str, Any]] = {}
    for index, name in enumerate(FEATURE_NAMES):
        values = np.asarray(x[:, index], dtype=np.float64)
        edges = np.unique(np.quantile(values, np.linspace(0, 1, 11)))
        if len(edges) < 3:
            low = float(values.min())
            high = float(values.max())
            edges = np.asarray([low - 1e-6, low + 0.5, high + 1e-6])
        counts, bins = np.histogram(values, bins=edges)
        proportions = (counts / max(1, counts.sum())).tolist()
        profile[name] = {
            "bins": [float(value) for value in bins],
            "proportions": [float(max(value, 1e-6)) for value in proportions],
            "mean": float(np.mean(values)),
            "std": float(np.std(values)),
        }
    return profile


def _fingerprint(x: np.ndarray, y: np.ndarray) -> str:
    digest = hashlib.sha256()
    digest.update(np.ascontiguousarray(x).tobytes())
    digest.update(np.ascontiguousarray(y).tobytes())
    return digest.hexdigest()


def train_and_register(
    state_dir: str | Path,
    *,
    n: int = 2500,
    seed: int = 42,
    challenger: bool = False,
    stage: str = "candidate",
) -> dict[str, Any]:
    root = Path(state_dir)
    root.mkdir(parents=True, exist_ok=True)
    x, y = generate_synthetic_training_data(n=n, seed=seed)
    profile = build_training_profile(x)
    split = int(len(x) * 0.80)
    x_train, x_test = x[:split], x[split:]
    y_train, y_test = y[:split], y[split:]

    tracker = ExperimentTracker(root / "experiments.db")
    registry = ModelRegistry(root / "registry")
    data_fingerprint = _fingerprint(x, y)
    run_id = tracker.start_run(
        model_name="falcon-risk",
        task="binary_classification",
        data_fingerprint=data_fingerprint,
        params={"rows": n, "seed": seed, "challenger": challenger},
    )
    artifact_dir = root / "run_artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / f"{run_id}.joblib"

    try:
        bundle = fit_bundle(
            x_train,
            y_train,
            profile=profile,
            model_label="challenger" if challenger else "champion",
            seed=seed,
            challenger=challenger,
        )
        probability = bundle.classifier.predict_proba(x_test)[:, 1]
        auc = float(roc_auc_score(y_test, probability))
        if not math.isfinite(auc):
            raise RuntimeError("Non-finite validation AUC")
        joblib.dump(bundle, artifact_path)
        registered = registry.register(
            model_name="falcon-risk",
            run_id=run_id,
            source_artifact=artifact_path,
            metric_name="roc_auc",
            metric_value=auc,
            metadata={
                "synthetic_training": True,
                "rows": n,
                "seed": seed,
                "role": "challenger" if challenger else "champion",
                "feature_names": FEATURE_NAMES,
            },
            stage=stage,
        )
        tracker.complete_run(
            run_id,
            metric_name="roc_auc",
            metric_value=auc,
            artifact_uri=registered["artifact_uri"],
        )
        return registered
    except Exception as exc:
        tracker.fail_run(run_id, str(exc))
        raise
