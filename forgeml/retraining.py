from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RetrainingDecision:
    should_retrain: bool
    reasons: list[str]


class RetrainingPolicy:
    """Policy gate for automated retraining triggers."""

    def __init__(
        self,
        *,
        drift_threshold: float = 0.20,
        max_performance_drop: float = 0.05,
    ):
        self.drift_threshold = float(drift_threshold)
        self.max_performance_drop = float(max_performance_drop)

    def evaluate(
        self,
        *,
        drift_report: dict[str, Any] | None = None,
        baseline_metric: float | None = None,
        current_metric: float | None = None,
    ) -> RetrainingDecision:
        reasons: list[str] = []
        if drift_report is not None:
            max_drift = float(drift_report.get("max_drift_score", 0.0))
            if max_drift >= self.drift_threshold:
                reasons.append(
                    f"feature drift {max_drift:.4f} >= threshold {self.drift_threshold:.4f}"
                )

        if baseline_metric is not None and current_metric is not None:
            drop = float(baseline_metric) - float(current_metric)
            if drop >= self.max_performance_drop:
                reasons.append(
                    f"performance drop {drop:.4f} >= threshold {self.max_performance_drop:.4f}"
                )

        return RetrainingDecision(should_retrain=bool(reasons), reasons=reasons)
