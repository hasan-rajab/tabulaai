from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import joblib

from falcon.features import OnlineFeatureStore
from falcon.schema import RiskDecision, TransactionEvent
from falcon.storage import DecisionStore
from forgeml.registry import ModelRegistry


class FalconDecisionEngine:
    """Point-in-time real-time risk engine with deterministic experimentation."""

    def __init__(self, state_dir: str | Path):
        self.root = Path(state_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.registry = ModelRegistry(self.root / "registry")
        self.features = OnlineFeatureStore(self.root / "falcon.db")
        self.store = DecisionStore(self.root / "falcon.db")
        self._bundle_cache: dict[str, Any] = {}

    @staticmethod
    def bucket(transaction_id: str) -> int:
        digest = hashlib.sha256(transaction_id.encode("utf-8")).digest()
        return int.from_bytes(digest[:4], "big") % 100

    def _load_bundle(self, artifact_uri: str):
        if artifact_uri not in self._bundle_cache:
            self._bundle_cache[artifact_uri] = joblib.load(artifact_uri)
        return self._bundle_cache[artifact_uri]

    @staticmethod
    def _policy(score: float, features: dict[str, float]) -> tuple[str, list[str]]:
        reasons: list[str] = []
        if features["new_device"]:
            reasons.append("new_device_for_account")
        if features["country_changed"]:
            reasons.append("country_changed_from_recent_activity")
        if features["velocity_5m"] >= 3:
            reasons.append("high_five_minute_velocity")
        if features["amount_zscore_24h"] >= 2.5:
            reasons.append("amount_above_recent_account_pattern")
        if features["merchant_risk"] >= 0.55:
            reasons.append("elevated_merchant_category_risk")
        if features["device_accounts_24h"] >= 3:
            reasons.append("device_shared_across_multiple_accounts")
        if features["night_hour"]:
            reasons.append("unusual_time_window")

        hard_review = (
            features["amount"] >= 5000
            and features["new_device"]
            and features["country_changed"]
        )
        if hard_review or score >= 0.72:
            decision = "manual_review"
        elif score >= 0.38:
            decision = "step_up"
        else:
            decision = "approve"
        if not reasons:
            reasons.append("model_risk_score")
        return decision, reasons[:5]

    def decide(self, event: TransactionEvent) -> RiskDecision:
        existing = self.store.get_decision(event.transaction_id)
        if existing is not None:
            return RiskDecision(
                transaction_id=existing["transaction_id"],
                decision=existing["decision"],
                risk_score=existing["risk_score"],
                supervised_score=existing["supervised_score"],
                anomaly_score=existing["anomaly_score"],
                model_version=existing["model_version"],
                model_role=existing["model_role"],
                champion_score=existing["champion_score"],
                challenger_score=existing["challenger_score"],
                experiment_bucket=existing["experiment_bucket"],
                reasons=existing["reasons"],
                created_at=existing["created_at"],
            )

        feature_row = self.features.build(event)
        champion_meta = self.registry.resolve("falcon-risk", "production")
        champion = self._load_bundle(champion_meta["artifact_uri"])
        champion_scores = champion.score(feature_row)

        experiment = self.store.get_experiment()
        bucket = self.bucket(event.transaction_id)
        challenger_scores: dict[str, float] | None = None
        challenger_meta: dict[str, Any] | None = None
        assigned = (
            experiment["challenger_version"] is not None
            and int(experiment["traffic_percent"]) > 0
            and bucket < int(experiment["traffic_percent"])
        )
        if assigned:
            challenger_meta = self.registry.get("falcon-risk", int(experiment["challenger_version"]))
            challenger = self._load_bundle(challenger_meta["artifact_uri"])
            challenger_scores = challenger.score(feature_row)

        use_challenger = bool(
            assigned and experiment["mode"] == "active" and challenger_scores is not None
        )
        selected_scores = challenger_scores if use_challenger else champion_scores
        selected_meta = challenger_meta if use_challenger else champion_meta
        if selected_scores is None or selected_meta is None:
            raise RuntimeError("No selected model available")

        action, reasons = self._policy(float(selected_scores["risk_score"]), feature_row)
        result = RiskDecision(
            transaction_id=event.transaction_id,
            decision=action,
            risk_score=float(selected_scores["risk_score"]),
            supervised_score=float(selected_scores["supervised_score"]),
            anomaly_score=float(selected_scores["anomaly_score"]),
            model_version=int(selected_meta["version"]),
            model_role="challenger" if use_challenger else "champion",
            champion_score=float(champion_scores["risk_score"]),
            challenger_score=(
                float(challenger_scores["risk_score"]) if challenger_scores is not None else None
            ),
            experiment_bucket=bucket if experiment["challenger_version"] is not None else None,
            reasons=reasons,
        )
        self.store.save_decision(result, feature_row)
        # Record only after scoring so the current transaction cannot influence
        # its own point-in-time velocity or novelty features.
        self.features.record(event)
        return result
