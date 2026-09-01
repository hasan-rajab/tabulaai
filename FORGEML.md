# ForgeML — MLOps Lifecycle Platform

ForgeML is a compact, production-style MLOps platform for taking tabular machine-learning models from validated data to governed deployment.

## Problem

A model with a strong offline metric is not a production ML system. Production teams need reproducibility, lineage, controlled promotion, rollback, drift monitoring, and explicit retraining criteria. ForgeML implements those lifecycle contracts in a small system that can run locally and in CI.

## Lifecycle

```text
Dataset
  -> validation + SHA-256 fingerprint
  -> tracked experiment
  -> train + evaluate
  -> immutable model registry
  -> candidate / staging / production / archived
  -> stable or canary deployment
  -> prediction API
  -> feature drift monitoring
  -> retraining recommendation
  -> promotion or rollback
```

## Engineering decisions

### Fail before training
`forgeml.validation.DatasetValidator` checks target validity, schema, missingness, duplicates, constant/unusable features, task compatibility, and dataset fingerprinting before a run can succeed.

### Durable experiment lineage
`forgeml.tracking.ExperimentTracker` stores run ID, model name, task, data fingerprint, parameters, lifecycle state, metric, artifact URI, timestamps, and failure details in SQLite.

### Immutable versioned registry
`forgeml.registry.ModelRegistry` stores versioned artifacts and explicit `candidate`, `staging`, `production`, and `archived` stages. Production selection never means "whatever file was written last."

### Transactional train -> evaluate -> register
`forgeml.training.ForgeTrainer` validates data, creates a tracked run, trains/evaluates, captures the reference feature distribution, serializes the inference bundle, registers the artifact, and marks the run complete. Failures are recorded and temporary artifacts are cleaned up.

### Safe deployment state
`forgeml.deployment.DeploymentManager` supports stable deployment, deterministic canary routing, challenger promotion, and rollback to the prior stable version.

### Drift + retraining policy
`forgeml.monitoring` compares live inputs with the training reference using PSI-style numeric drift and categorical total-variation distance. `forgeml.retraining` returns explicit retraining recommendations based on drift or performance degradation; it does not auto-promote a new model.

## Serving

FastAPI endpoints cover prediction, monitoring, deployment status, stable deployment, canary deployment, canary promotion, and rollback. Prediction responses report the actual model version used.

## Verification

GitHub Actions gates:

- Python 3.12 dependency installation
- source compilation
- end-to-end lifecycle regression tests
- API import
- non-root production container build

Regression coverage includes validated training, tracked experiments, registry artifacts, inference, two-version canary traffic, promotion, rollback, feature drift, retraining triggers, and invalid-data rejection.

## Stack

Python 3.12 · scikit-learn · Pandas · NumPy · FastAPI · SQLite · Joblib · Docker · GitHub Actions

## Run

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-forgeml.txt
python -m forgeml.cli train data.csv --target churn --model-name churn-model
python -m forgeml.cli serve
```

Container:

```bash
docker build -f Dockerfile.forgeml -t forgeml:local .
```

## Boundaries

ForgeML intentionally uses SQLite and local filesystem artifacts so the full lifecycle is runnable on a laptop and in CI. In a distributed production deployment these interfaces would normally use PostgreSQL, object storage, managed model registries, and distributed telemetry services.

The drift monitor detects distribution movement; it does not prove model-quality degradation. Production retraining should combine drift with delayed labels, business KPIs, and human release criteria.
