# ForgeML

**A compact MLOps platform for taking tabular ML from validated data to governed production deployment.**

ForgeML evolved from the original **TabulaAI** AutoML project. The existing Streamlit application and benchmarking code remain in the repository, but the project now adds a production-style lifecycle control plane around model development:

```text
Dataset
  -> validation + fingerprint
  -> tracked experiment
  -> train + evaluate
  -> versioned model registry
  -> candidate / staging / production
  -> stable or canary deployment
  -> prediction API
  -> feature drift monitoring
  -> retraining policy
  -> promotion or rollback
```

The goal is not to recreate a commercial MLOps suite. ForgeML is an interview-defensible implementation of the engineering contracts that production ML systems need: reproducibility, lineage, controlled promotion, deployment safety, monitoring and rollback.

## Why ForgeML exists

A notebook that produces a good metric is not a production ML system. The hard problems begin after training:

- Was the dataset valid before the run started?
- Which exact data produced model version 3?
- Which metric justified promotion?
- Which artifact is currently serving traffic?
- Can a challenger receive only 10% of requests?
- Can deployment be rolled back without retraining?
- Has the input distribution moved away from training data?
- When should retraining be triggered?

ForgeML makes those states explicit and testable.

## Core capabilities

### 1. Training-data contract

`forgeml.validation.DatasetValidator` runs before training and records:

- dataset size and schema
- target validity
- classification/regression contract
- missingness limits
- duplicate-row warnings
- unusable/constant feature warnings
- a SHA-256 data fingerprint

Invalid datasets fail before an experiment can be registered as successful.

### 2. Durable experiment tracking

`forgeml.tracking.ExperimentTracker` stores every run in SQLite with:

- run ID
- model name
- task
- data fingerprint
- training parameters
- lifecycle status (`running`, `completed`, `failed`)
- evaluation metric
- artifact URI
- timestamps and failure reason

This provides lightweight experiment lineage without requiring an external tracking server.

### 3. Versioned model registry

`forgeml.registry.ModelRegistry` stores immutable model artifacts under versioned directories and tracks explicit stages:

- `candidate`
- `staging`
- `production`
- `archived`

Promotion to production archives the previous production registry stage. Artifacts are never selected merely because they are the newest file on disk.

### 4. Transactional train -> evaluate -> register flow

`forgeml.training.ForgeTrainer` performs the lifecycle as one operation:

1. validate data
2. fingerprint the dataset
3. create an experiment run
4. split train/test data
5. construct preprocessing for numeric and categorical features
6. train a classification or regression pipeline
7. evaluate it
8. capture the training feature distribution
9. serialize the complete inference bundle
10. register a new candidate version
11. mark the experiment complete

If training or registration fails, the experiment is marked failed and temporary artifacts are removed.

Current compact reference estimators are:

- classification: logistic regression with class balancing
- regression: random forest regression

The registry/lifecycle interfaces are intentionally model-agnostic, so the estimator can be swapped for XGBoost, LightGBM, CatBoost or another serving-compatible pipeline.

### 5. Stable + canary deployment state

`forgeml.deployment.DeploymentManager` stores deployment state durably in SQLite.

Supported transitions:

```text
candidate -> staging -> production
                    \-> canary challenger

stable v1 + challenger v2 @ 10%
             |
             +-> promote -> stable v2
             |
             +-> discard / rollback

stable v2 -> rollback -> stable v1
```

Canary routing is deterministic from `request_id`, so the same request key maps to the same version while a canary is active.

### 6. Production-style prediction API

`forgeml.api` exposes FastAPI endpoints for:

- `GET /health`
- `POST /predict/{model_name}`
- `POST /monitor/{model_name}`
- `POST /deploy/stable`
- `POST /deploy/canary`
- `POST /deploy/{model_name}/promote-canary`
- `POST /deploy/{model_name}/rollback`
- `GET /deploy/{model_name}`

Prediction responses include the actual model version used for the request, making canary behavior observable to callers.

### 7. Drift monitoring

Every trained model bundle contains a reference profile generated from its training features.

`forgeml.monitoring.compute_drift` compares current traffic with that reference using:

- PSI-style distribution drift for numeric features
- total-variation distance for categorical features
- missing-feature detection
- per-feature scores
- overall and maximum drift scores

Drift is reported; it does not silently replace a production model.

### 8. Retraining policy

`forgeml.retraining.RetrainingPolicy` can trigger retraining when either:

- feature drift exceeds a configured threshold, or
- observed performance drops beyond a configured tolerance.

The policy returns explicit reasons rather than performing an opaque automatic promotion. A retrained model still enters the registry as a candidate and must pass deployment gates.

### 9. Rollback

Every stable replacement keeps the previous stable version. Rollback changes deployment state back to that version without requiring a new model build.

This is deliberate: retraining is not a rollback strategy.

## Quick start

Create a ForgeML-only environment:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-forgeml.txt
```

Train and register a model:

```bash
python -m forgeml.cli train data.csv \
  --target churn \
  --model-name churn-model
```

Inspect the output to obtain the registered version, then deploy it:

```bash
python -m forgeml.cli deploy \
  --model-name churn-model \
  --version 1
```

Start the serving API:

```bash
python -m forgeml.cli serve
```

Start a challenger at 10% traffic:

```bash
python -m forgeml.cli canary \
  --model-name churn-model \
  --version 2 \
  --fraction 0.10
```

Promote the challenger:

```bash
python -m forgeml.cli promote-canary --model-name churn-model
```

Rollback:

```bash
python -m forgeml.cli rollback --model-name churn-model
```

Inspect deployment, registry and experiment history:

```bash
python -m forgeml.cli status --model-name churn-model
```

## Container

Build the dedicated serving image:

```bash
docker build -f Dockerfile.forgeml -t forgeml:local .
```

Run with persistent state mounted into `/var/lib/forgeml`:

```bash
docker run --rm -p 8000:8000 \
  -v "$(pwd)/.forgeml:/var/lib/forgeml" \
  forgeml:local
```

The container runs as a non-root user and exposes a health check.

## CI release gates

`.github/workflows/forgeml-ci.yml` verifies on pull requests to `main`:

- Python 3.12 dependency installation
- source compilation
- end-to-end lifecycle regression tests
- API import
- production container build

The lifecycle tests cover:

- validated training -> tracked experiment -> registry candidate
- artifact loading and inference
- two-version canary traffic routing
- canary promotion
- rollback to the prior stable version
- feature-drift detection
- drift-triggered retraining policy
- performance-drop retraining policy
- invalid training-data rejection

## Repository layout

```text
forgeml/
├── validation.py        # data contracts + fingerprinting
├── tracking.py          # SQLite experiment lineage
├── registry.py          # versioned model artifacts + stages
├── training.py          # validation -> train -> evaluate -> register
├── deployment.py        # stable/canary state + routing + rollback
├── monitoring.py        # numeric/categorical drift detection
├── retraining.py        # retraining decision policy
├── api.py               # prediction, monitoring and deployment API
└── cli.py               # lifecycle command line interface

tests/
└── test_forgeml_lifecycle.py

Dockerfile.forgeml
requirements-forgeml.txt
.github/workflows/forgeml-ci.yml

# Original TabulaAI application remains available
app.py
core/
models/
intelligence/
ui/
```

## Engineering boundaries

ForgeML currently uses local SQLite and filesystem artifacts so the full lifecycle is runnable on a laptop and in CI. In a multi-node production deployment these interfaces would normally be backed by services such as PostgreSQL, object storage, a managed registry and a distributed telemetry store.

The drift monitor detects distribution movement; it does not prove model-quality degradation. Production retraining should combine drift with delayed labels, business KPIs and human release criteria.

Canary routing here controls model-version selection inside the application. At larger scale the same policy would normally integrate with an API gateway, service mesh or model-serving platform.

## Original TabulaAI

The repository began as a domain-agnostic conversational data-science assistant that benchmarks tabular models, provides explainability and offers a Streamlit interface. That code remains intact as a useful experimentation surface. ForgeML adds the missing operational layer around training and serving rather than discarding the original project.
