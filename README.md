# ForgeML + Falcon

**A production-style ML control plane and streaming decision system for moving models from experiments into governed operational decisions.**

This repository contains two connected systems:

- **ForgeML** — model lifecycle governance: data validation, lineage, registry, promotion, canary, drift, retraining and rollback.
- **Falcon** — real-time transaction-risk decisioning: streaming features, supervised + anomaly scoring, champion/challenger experiments and delayed-label monitoring.

Together they answer one business/engineering question:

> **How do you turn an offline model into an observable, reversible and governable production decision process?**

The original TabulaAI experimentation application remains in the repository as project lineage.

> **Scope:** portfolio-grade production-style systems. Synthetic data is used for reproducible bootstrap/regression behavior; no real financial institution or live payment rail is connected.

---

## Executive view

| Operating problem | System response |
|---|---|
| Experiments are hard to reproduce | dataset fingerprints, tracked runs and versioned model artifacts |
| Model promotion is risky | explicit candidate → staging → production lifecycle |
| New models need safe exposure | deterministic canary and champion/challenger modes |
| Risk decisions need streaming context | Kafka + point-in-time transaction features |
| Fraud labels arrive late | delayed-feedback monitoring and performance comparison |
| Drift should not silently deploy a model | monitoring can recommend retraining; promotion remains explicit |
| Rollback must be fast | prior production versions remain addressable and restorable |

---

## Business value

The repository is designed around three enterprise concerns.

### 1. Controlled model change
Teams need evidence that a candidate is traceable, testable and reversible before it influences production decisions.

### 2. Decision quality under asymmetric cost
In fraud/risk scenarios, a false decline, missed fraud and manual-review decision have different business costs. Falcon therefore exposes a governed decision surface rather than reducing the problem to raw accuracy.

### 3. Operational learning
Real labels may arrive after a transaction has already been scored. The system preserves decision/experiment context so delayed outcomes can be used to compare champion and challenger behavior.

A real deployment should optimize against business-cost and risk KPIs — loss prevented, false-positive burden, manual-review load, approval latency and customer friction — not only ROC-AUC.

---

## Architecture

```text
                 OFFLINE / RELEASE PLANE

training data
    ↓
ForgeML
  validation
  dataset fingerprint
  experiment tracking
  model registry
  candidate → staging → production
  canary / rollback
    ↓
governed model version
    ↓

                 ONLINE / DECISION PLANE

Kafka transactions
    ↓
point-in-time features
    ↓
XGBoost + autoencoder
    ↓
champion / challenger assignment
    ↓
decision policy
  ├── approve
  ├── step_up
  └── manual_review
    ↓
persisted decision + experiment context
    ↓
delayed labels / drift / performance
    ↓
retraining candidate in ForgeML
```

---

## Verified engineering evidence

Reference workflows on **10 September 2026**:

### ForgeML CI run #105 — success
The lifecycle-integrity job completed:
- source compilation;
- **5/5 lifecycle tests passed**;
- model/API import checks;
- separate non-root container build.

The tested lifecycle includes:
- tracked/registered training candidates;
- durable canary promotion and rollback;
- drift-triggered retraining policy behavior.

### Falcon CI run #102 — success
The decisioning-integrity job completed:
- Falcon + ForgeML compilation;
- **7/7 end-to-end decisioning tests passed**;
- clean champion/challenger bootstrap;
- separate non-root container build.

The tests cover decisioning behavior including champion/challenger setup, delayed feedback and retraining paths.

> Synthetic bootstrap data and CI regression behavior are not claims of real financial-fraud accuracy.

---

## Engineering controls that matter

### Point-in-time feature safety
Online features are computed before the current transaction is persisted, reducing label/future-information leakage risk.

### Reproducible lineage
Datasets, runs and model artifacts have explicit identities and fingerprints.

### Safe releases
Candidates can be shadowed or traffic-split before production promotion.

### Rollback is a deployment operation
Reverting to a known model does not require retraining.

### Idempotent serving
A replayed event returns the persisted decision rather than creating contradictory outcomes.

### Monitoring is advisory, not autonomous deployment
Drift/performance signals can create evidence and retraining candidates; promotion stays explicit.

---

## Technology

**ML:** XGBoost · scikit-learn · autoencoder anomaly scoring  
**Streaming:** Kafka  
**Serving/control:** FastAPI  
**Lifecycle:** experiment tracking · model registry · canary · rollback  
**Persistence:** SQLite local control-plane state  
**Observability:** Prometheus  
**Delivery:** Docker · Docker Compose · GitHub Actions

---

## Quick start

### ForgeML

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-forgeml.txt
python -m forgeml.cli train data.csv --target churn --model-name churn-model
python -m forgeml.cli serve
```

### Falcon

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-falcon.txt
python -m falcon.cli --state-dir .falcon bootstrap
python -m falcon.cli --state-dir .falcon serve
```

Kafka stack:

```bash
docker compose -f docker-compose.falcon.yml up --build
```

---

## Deeper case studies

- [ForgeML engineering case](FORGEML.md)
- [Falcon engineering case](FALCON.md)
- [System engineering notes](docs/ENGINEERING_NOTES.md)

---

## What a real production implementation would add

A distributed deployment would typically replace local SQLite/filesystem state with managed databases/object storage, use production feature infrastructure, centralized observability, enterprise IAM/secrets and managed model-serving components.

Falcon **does not execute payment declines or move money**. Its output is a governed decision recommendation surface used to demonstrate real-time ML engineering and controlled model release patterns.
