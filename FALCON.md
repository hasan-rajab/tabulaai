# Falcon

**Real-time AI transaction risk decisioning with Kafka, point-in-time features, champion/challenger models, drift monitoring and feedback retraining.**

Falcon is a production-style reference workload built beside ForgeML. ForgeML supplies experiment lineage and the model registry; Falcon exercises those contracts inside a live decision service.

> Falcon uses synthetic data for engineering validation. It does not move money and is not a certified fraud/payment authorization system.

## Flow

```text
transaction -> Kafka -> point-in-time features
            -> XGBoost champion + autoencoder anomaly
            -> optional challenger (shadow/active bucket)
            -> approve / step_up / manual_review
            -> durable decision ledger -> Kafka/API/dashboard
            -> delayed feedback -> drift/performance monitoring
            -> new ForgeML candidate -> promote or rollback
```

## Key contracts

- **Point-in-time features:** the current transaction is stored only after it is scored, preventing self/future leakage into velocity and novelty signals.
- **Dual-model scoring:** `0.80 * XGBoost probability + 0.20 * normalized autoencoder anomaly` with both components exposed separately.
- **ForgeML lineage:** every model has a run, fingerprint, metric, immutable artifact and lifecycle stage. Demo models are marked `synthetic_training=true`.
- **Champion/challenger:** SHA-256 transaction buckets make experiment assignment deterministic. Shadow mode records challenger scores without changing the action; active mode lets only the assigned bucket use the challenger.
- **Idempotency:** `transaction_id` is the decision key. Kafka input is committed only after the durable decision and acknowledged output event.
- **Monitoring:** PSI-style feature drift plus delayed-label Brier/ROC-AUC comparisons for champion and challenger.
- **Retraining:** feedback creates a new candidate; it never silently replaces production.
- **Release safety:** challenger promotion and rollback are explicit registry transitions.

## Decision policy

```text
risk < 0.38          -> approve
0.38 <= risk < 0.72  -> step_up
risk >= 0.72         -> manual_review
```

Falcon deliberately avoids an autonomous decline side effect.

## Run locally

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-falcon.txt
python -m falcon.cli --state-dir .falcon_state bootstrap
python -m falcon.cli --state-dir .falcon_state serve --port 8080
```

Open `http://localhost:8080` for the live dashboard.

Kafka development stack:

```bash
docker compose -f docker-compose.falcon.yml up --build
```

Topics are `falcon.transactions` and `falcon.decisions`.

## Main API

- `POST /decide`
- `POST /feedback`
- `GET /decisions`
- `GET /monitoring`
- `GET /models`
- `GET /experiment`
- `GET /metrics`
- `POST /admin/experiment`
- `POST /admin/promote/{version}`
- `POST /admin/rollback/{version}`
- `GET /admin/retraining/recommendation`
- `POST /admin/retrain`

When `FALCON_ADMIN_KEY` is configured, admin endpoints require `X-Admin-Key`.

## CI

`falcon-ci.yml` gates release on source compilation, end-to-end decision tests, API/Kafka imports, clean model bootstrap, non-root container build and Compose validation. Tests cover point-in-time features, idempotency, shadow/active routing, promotion/rollback, delayed feedback, feedback retraining, drift, dashboard/API behavior and admin-key enforcement.

## Boundaries

SQLite and the Kafka Compose topology are laptop/CI implementations. A scaled deployment would use a shared low-latency feature store and transactional decision ledger. Synthetic ROC-AUC is not evidence of real fraud performance; real payments usage would require calibration, privacy/security review, resilience, model-risk governance, fairness review and regulated payment integration.
