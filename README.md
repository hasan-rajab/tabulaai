# ForgeML + Falcon

**Two production-style AI engineering systems: governed MLOps lifecycle management and real-time streaming decisioning.**

This repository contains two connected flagship projects built around one engineering question:

> **How do you take machine learning from offline experiments to controlled, observable production decisions?**

- **ForgeML** manages the model lifecycle: validated data, experiment lineage, registry versions, deployment stages, canary releases, drift monitoring, retraining recommendations, and rollback.
- **Falcon** is the production workload: a Kafka-driven transaction-risk decision system with point-in-time features, XGBoost + autoencoder scoring, champion/challenger experimentation, delayed-label monitoring, and governed model promotion.

The original TabulaAI experimentation application remains in the repository as the project lineage that preceded ForgeML.

## Recruiter quick scan

| Project | Problem solved | Core engineering evidence |
| --- | --- | --- |
| **ForgeML** | Govern ML from dataset to production release | data contracts, SHA-256 lineage, experiment tracking, model registry, FastAPI serving, drift, canary, rollback, CI |
| **Falcon** | Make low-latency risk decisions on streaming transaction events | Kafka, point-in-time features, XGBoost + autoencoder, champion/challenger, delayed feedback, Prometheus, Docker |

**Primary stack:** Python 3.12 · FastAPI · Kafka · XGBoost · scikit-learn · SQLite · Prometheus · Docker · GitHub Actions

## Architecture relationship

```text
                 OFFLINE / RELEASE PLANE

training data
    |
    v
+---------------------------+
| ForgeML                   |
| validation + fingerprint  |
| experiment tracking       |
| model registry            |
| candidate/staging/prod    |
| canary + rollback         |
+-------------+-------------+
              |
              | governed model version
              v

                 ONLINE / DECISION PLANE

Kafka transactions
      |
      v
+---------------------------+
| Falcon                    |
| point-in-time features    |
| XGBoost + autoencoder     |
| champion/challenger       |
| decision policy           |
+-------------+-------------+
              |
              +--> approve
              +--> step_up
              +--> manual_review
              |
              v
      decisions + feedback
              |
              +--> drift/performance monitoring
              +--> candidate retraining in ForgeML
```

## ForgeML

ForgeML is a compact MLOps control plane implementing:

- fail-fast training-data validation
- SHA-256 dataset fingerprinting
- durable SQLite experiment tracking
- immutable versioned model artifacts
- `candidate -> staging -> production -> archived` lifecycle
- FastAPI prediction serving
- deterministic canary routing
- explicit promotion and rollback
- numeric and categorical drift detection
- performance/drift-based retraining recommendations
- non-root Docker serving
- CI regression gates

Read the engineering case study: **[FORGEML.md](FORGEML.md)**

## Falcon

Falcon is a real-time transaction-risk decision system implementing:

- Kafka input/output worker with manual offset commits
- idempotent transaction replay
- point-in-time velocity, novelty, amount-deviation and behavioral features
- XGBoost supervised risk scoring
- bottleneck autoencoder anomaly scoring
- governed score fusion and `approve / step_up / manual_review` decisions
- deterministic champion/challenger assignment
- shadow and active experiment modes
- delayed fraud-label feedback
- Brier score / ROC-AUC comparison
- PSI-style feature-drift monitoring
- candidate retraining through ForgeML
- explicit challenger promotion and rollback
- FastAPI control plane, Prometheus metrics and browser dashboard
- non-root Docker image + Kafka Compose stack

Read the engineering case study: **[FALCON.md](FALCON.md)**

## Verification evidence

The repository has separate GitHub Actions release gates for both systems.

### ForgeML CI

- source compilation
- lifecycle regression tests
- API import
- non-root container build

### Falcon CI

- Falcon + ForgeML source compilation
- **7/7 end-to-end Falcon decisioning regression tests**
- API + Kafka worker imports
- clean champion/challenger bootstrap
- non-root Falcon container build
- Kafka Compose validation

The Falcon bootstrap uses synthetic training data and marks that provenance explicitly in registry metadata. Its metrics are demonstration/regression evidence, not claims of real financial-fraud accuracy.

## Engineering principles demonstrated

1. **No label leakage:** online features are computed before the current transaction is persisted.
2. **Reproducible lineage:** datasets, runs and model artifacts have explicit identities.
3. **Safe releases:** challengers can be shadowed or traffic-split before promotion.
4. **Rollback is a deployment operation:** reverting does not require retraining.
5. **Delayed outcomes matter:** production model quality is evaluated against later labels, not just training metrics.
6. **Monitoring does not silently deploy:** drift/retraining creates evidence and candidates; promotion remains explicit.
7. **Idempotency is part of ML serving:** event replay returns the persisted decision instead of creating conflicting outcomes.

## Quick starts

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

Kafka development stack:

```bash
docker compose -f docker-compose.falcon.yml up --build
```

## Repository map

```text
forgeml/                  # MLOps lifecycle platform
falcon/                   # real-time decision engine
FORGEML.md                # ForgeML engineering case study
FALCON.md                  # Falcon engineering case study
Dockerfile.forgeml
Dockerfile.falcon
docker-compose.falcon.yml
requirements-forgeml.txt
requirements-falcon.txt
tests/
.github/workflows/

# Original TabulaAI experimentation layer
app.py
core/
models/
intelligence/
ui/
```

## Scope boundaries

These are portfolio-grade production-style systems, not claims of commercial deployment. Local SQLite/filesystem backends are used deliberately so lifecycle behavior remains reproducible on a laptop and in CI. A distributed production implementation would typically replace them with managed databases, object storage, distributed feature infrastructure and managed model-serving components.

Falcon does **not** execute payment declines or move money. Its policy output is a decision recommendation surface intended to demonstrate real-time AI engineering and controlled model release patterns.
