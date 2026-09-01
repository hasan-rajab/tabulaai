from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from falcon.features import FEATURE_NAMES


@dataclass
class FalconRiskBundle:
    feature_names: list[str]
    classifier: XGBClassifier
    scaler: StandardScaler
    autoencoder: MLPRegressor
    reconstruction_p50: float
    reconstruction_p99: float
    training_profile: dict[str, dict[str, Any]]
    model_label: str

    def vectorize(self, features: dict[str, float]) -> np.ndarray:
        missing = [name for name in self.feature_names if name not in features]
        if missing:
            raise ValueError(f"Missing features: {missing}")
        return np.asarray([[float(features[name]) for name in self.feature_names]], dtype=np.float64)

    def score(self, features: dict[str, float]) -> dict[str, float]:
        x = self.vectorize(features)
        supervised = float(self.classifier.predict_proba(x)[0, 1])
        scaled = self.scaler.transform(x)
        reconstructed = self.autoencoder.predict(scaled)
        reconstruction_error = float(np.mean((scaled - reconstructed) ** 2))
        denom = max(1e-9, self.reconstruction_p99 - self.reconstruction_p50)
        anomaly = float(np.clip((reconstruction_error - self.reconstruction_p50) / denom, 0.0, 1.0))
        fused = float(np.clip(0.80 * supervised + 0.20 * anomaly, 0.0, 1.0))
        return {
            "risk_score": fused,
            "supervised_score": supervised,
            "anomaly_score": anomaly,
            "reconstruction_error": reconstruction_error,
        }


def fit_bundle(
    x: np.ndarray,
    y: np.ndarray,
    *,
    profile: dict[str, dict[str, Any]],
    model_label: str,
    seed: int,
    challenger: bool = False,
) -> FalconRiskBundle:
    params = {
        "n_estimators": 90 if not challenger else 120,
        "max_depth": 4 if not challenger else 3,
        "learning_rate": 0.075 if not challenger else 0.055,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "tree_method": "hist",
        "n_jobs": 1,
        "random_state": seed,
    }
    classifier = XGBClassifier(**params)
    classifier.fit(x, y)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(x)
    autoencoder = MLPRegressor(
        hidden_layer_sizes=(8, 3, 8),
        activation="tanh",
        solver="adam",
        alpha=1e-4,
        max_iter=160,
        random_state=seed,
        early_stopping=True,
        validation_fraction=0.15,
        n_iter_no_change=12,
    )
    autoencoder.fit(scaled, scaled)
    reconstruction = autoencoder.predict(scaled)
    errors = np.mean((scaled - reconstruction) ** 2, axis=1)

    return FalconRiskBundle(
        feature_names=list(FEATURE_NAMES),
        classifier=classifier,
        scaler=scaler,
        autoencoder=autoencoder,
        reconstruction_p50=float(np.quantile(errors, 0.50)),
        reconstruction_p99=float(np.quantile(errors, 0.99)),
        training_profile=profile,
        model_label=model_label,
    )
