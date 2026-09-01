from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from falcon.api import create_app
from falcon.bootstrap import bootstrap_demo
from falcon.control import FalconReleaseController
from falcon.decision import FalconDecisionEngine
from falcon.features import FEATURE_NAMES
from falcon.monitoring import FalconMonitor, _psi
from falcon.retraining import RetrainingAdvisor, retrain_from_feedback
from falcon.schema import FeedbackEvent, RiskDecision, TransactionEvent
from falcon.storage import DecisionStore
from falcon.training import generate_synthetic_training_data
from forgeml.registry import ModelRegistry


@pytest.fixture(scope="module")
def state_dir(tmp_path_factory):
    root = tmp_path_factory.mktemp("falcon-state")
    bootstrap_demo(root, rows=700)
    return root


def _event(transaction_id: str, *, account: str = "acct-1", device: str = "dev-1", amount: float = 80.0, minute: int = 0):
    return TransactionEvent(
        transaction_id=transaction_id,
        account_id=account,
        device_id=device,
        amount=amount,
        currency="BHD",
        merchant_category="general",
        country="BH",
        card_present=False,
        timestamp=datetime(2026, 9, 1, 9, minute, tzinfo=timezone.utc),
    )


def test_bootstrap_creates_forgeml_champion_and_challenger(state_dir):
    registry = ModelRegistry(state_dir / "registry")
    production = registry.resolve("falcon-risk", "production")
    versions = registry.list_versions("falcon-risk")
    assert production["version"] == 1
    assert production["metadata"]["synthetic_training"] is True
    assert any(item["version"] == 2 and item["stage"] == "staging" for item in versions)


def test_decisions_are_idempotent_and_point_in_time(state_dir):
    engine = FalconDecisionEngine(state_dir)
    first = engine.decide(_event("txn-idempotent"))
    duplicate = engine.decide(_event("txn-idempotent", amount=9999.0))
    assert duplicate.model_dump() == first.model_dump()

    second = engine.decide(_event("txn-new-device", device="dev-new", amount=1500.0, minute=1))
    stored = engine.store.get_decision("txn-new-device")
    assert stored is not None
    assert stored["features"]["new_device"] == 1.0
    assert second.transaction_id == "txn-new-device"


def test_shadow_and_active_challenger_routing(state_dir):
    controller = FalconReleaseController(state_dir)
    engine = FalconDecisionEngine(state_dir)

    controller.configure_experiment(2, 100, "shadow")
    shadow = engine.decide(_event("txn-shadow", account="acct-shadow"))
    assert shadow.model_role == "champion"
    assert shadow.challenger_score is not None

    controller.configure_experiment(2, 100, "active")
    active = engine.decide(_event("txn-active", account="acct-active"))
    assert active.model_role == "challenger"
    assert active.model_version == 2
    assert active.challenger_score is not None

    controller.configure_experiment(2, 20, "shadow")


def test_release_promotion_and_rollback_are_explicit(state_dir):
    controller = FalconReleaseController(state_dir)
    promoted = controller.promote(2)
    assert promoted["previous_version"] == 1
    assert promoted["production_version"] == 2
    rolled_back = controller.rollback(1)
    assert rolled_back["rolled_back_from"] == 2
    assert rolled_back["production_version"] == 1
    controller.configure_experiment(2, 20, "shadow")


def test_feedback_monitoring_and_feedback_retraining(state_dir):
    store = DecisionStore(state_dir / "falcon.db")
    x, y = generate_synthetic_training_data(n=500, seed=123)
    for index in range(220):
        features = {name: float(x[index, feature_index]) for feature_index, name in enumerate(FEATURE_NAMES)}
        champion = 0.82 if int(y[index]) else 0.16
        challenger = 0.78 if int(y[index]) else 0.20
        decision = RiskDecision(
            transaction_id=f"feedback-{index}",
            decision="manual_review" if champion >= 0.72 else "approve",
            risk_score=champion,
            supervised_score=champion,
            anomaly_score=0.0,
            model_version=1,
            model_role="champion",
            champion_score=champion,
            challenger_score=challenger,
            experiment_bucket=index % 100,
            reasons=["test_feedback_fixture"],
        )
        store.save_decision(decision, features)
        store.record_feedback(FeedbackEvent(transaction_id=decision.transaction_id, is_fraud=bool(y[index])))

    monitor = FalconMonitor(state_dir)
    snapshot = monitor.snapshot()
    assert snapshot["experiment"]["labeled_count"] >= 220
    assert "brier" in snapshot["experiment"]["champion"]

    registered = retrain_from_feedback(state_dir, min_labels=200, seed=212)
    assert registered["version"] >= 3
    assert registered["stage"] == "candidate"
    assert registered["metadata"]["feedback_training"] is True
    assert RetrainingAdvisor(state_dir).recommend()["action"] in {"hold", "retrain", "promote_challenger"}


def test_drift_metric_detects_distribution_shift():
    assert _psi([0.5, 0.5], [0.02, 0.98]) > 0.2


def test_api_dashboard_decision_feedback_and_admin_guard(state_dir, monkeypatch):
    monkeypatch.setenv("FALCON_ADMIN_KEY", "secret")
    client = TestClient(create_app(state_dir))
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ready"] is True

    response = client.post(
        "/decide",
        json={
            "transaction_id": "txn-api",
            "account_id": "acct-api",
            "device_id": "dev-api",
            "amount": 220.0,
            "currency": "BHD",
            "merchant_category": "electronics",
            "country": "BH",
            "card_present": False,
            "timestamp": "2026-09-01T10:00:00Z",
        },
    )
    assert response.status_code == 200
    assert response.json()["decision"] in {"approve", "step_up", "manual_review"}

    feedback = client.post("/feedback", json={"transaction_id": "txn-api", "is_fraud": False})
    assert feedback.status_code == 200
    assert client.get("/").status_code == 200
    assert "Falcon" in client.get("/").text
    assert client.get("/metrics").status_code == 200

    denied = client.post(
        "/admin/experiment",
        json={"challenger_version": 2, "traffic_percent": 10, "mode": "shadow"},
    )
    assert denied.status_code == 403
    allowed = client.post(
        "/admin/experiment",
        headers={"X-Admin-Key": "secret"},
        json={"challenger_version": 2, "traffic_percent": 10, "mode": "shadow"},
    )
    assert allowed.status_code == 200
