from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


_EPS = 1e-6


def build_reference_profile(df: pd.DataFrame) -> dict[str, Any]:
    """Build compact feature-distribution statistics for drift monitoring."""
    profile: dict[str, Any] = {"rows": int(len(df)), "features": {}}
    for column in df.columns:
        series = df[column]
        if pd.api.types.is_numeric_dtype(series):
            clean = pd.to_numeric(series, errors="coerce").dropna().astype(float)
            if clean.empty:
                profile["features"][str(column)] = {"kind": "numeric", "empty": True}
                continue
            quantiles = np.unique(np.quantile(clean, [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]))
            if len(quantiles) < 3:
                mean = float(clean.mean())
                std = float(clean.std(ddof=0) or 1.0)
                quantiles = np.array([mean - std, mean, mean + std], dtype=float)
            edges = quantiles.astype(float)
            edges[0] = -np.inf
            edges[-1] = np.inf
            counts, _ = np.histogram(clean, bins=edges)
            probs = (counts / max(counts.sum(), 1)).astype(float)
            profile["features"][str(column)] = {
                "kind": "numeric",
                "edges": [float(value) if math.isfinite(float(value)) else str(value) for value in edges],
                "probabilities": probs.tolist(),
                "missing_fraction": float(series.isna().mean()),
            }
        else:
            normalized = series.fillna("__MISSING__").astype(str)
            frequencies = normalized.value_counts(normalize=True).head(20)
            profile["features"][str(column)] = {
                "kind": "categorical",
                "probabilities": {str(key): float(value) for key, value in frequencies.items()},
                "missing_fraction": float(series.isna().mean()),
            }
    return profile


def _deserialize_edges(values: list[Any]) -> np.ndarray:
    out = []
    for value in values:
        if value == "-inf":
            out.append(-np.inf)
        elif value == "inf":
            out.append(np.inf)
        else:
            out.append(float(value))
    return np.asarray(out, dtype=float)


def _psi(expected: np.ndarray, actual: np.ndarray) -> float:
    expected = np.clip(expected.astype(float), _EPS, 1.0)
    actual = np.clip(actual.astype(float), _EPS, 1.0)
    return float(np.sum((actual - expected) * np.log(actual / expected)))


def compute_drift(
    reference_profile: dict[str, Any],
    current: pd.DataFrame,
    threshold: float = 0.20,
) -> dict[str, Any]:
    feature_scores: dict[str, float] = {}
    missing_features: list[str] = []

    for feature, spec in reference_profile.get("features", {}).items():
        if feature not in current.columns:
            missing_features.append(feature)
            feature_scores[feature] = 1.0
            continue
        series = current[feature]
        if spec.get("kind") == "numeric" and not spec.get("empty"):
            clean = pd.to_numeric(series, errors="coerce").dropna().astype(float)
            edges = _deserialize_edges(spec["edges"])
            counts, _ = np.histogram(clean, bins=edges)
            actual = counts / max(counts.sum(), 1)
            expected = np.asarray(spec["probabilities"], dtype=float)
            score = _psi(expected, actual)
        elif spec.get("kind") == "categorical":
            normalized = series.fillna("__MISSING__").astype(str)
            current_probs = normalized.value_counts(normalize=True).to_dict()
            expected_probs = spec.get("probabilities", {})
            keys = set(expected_probs) | set(current_probs)
            score = 0.5 * sum(
                abs(float(expected_probs.get(key, 0.0)) - float(current_probs.get(key, 0.0)))
                for key in keys
            )
        else:
            score = 0.0
        feature_scores[feature] = float(score)

    scores = list(feature_scores.values())
    drifted = sorted(feature for feature, score in feature_scores.items() if score >= threshold)
    return {
        "rows": int(len(current)),
        "threshold": float(threshold),
        "overall_drift_score": float(np.mean(scores)) if scores else 0.0,
        "max_drift_score": float(max(scores)) if scores else 0.0,
        "drift_detected": bool(drifted),
        "drifted_features": drifted,
        "missing_features": missing_features,
        "feature_scores": feature_scores,
    }
