# Engineering Notes — ForgeML + Falcon

This repository is intentionally two systems that exercise different production ML failure modes:

- **ForgeML** governs the model lifecycle: reproducibility, artifact lineage, promotion, rollback, drift, and retraining decisions.
- **Falcon** governs real-time decisions: event ordering, replay, point-in-time features, delayed labels, champion/challenger evaluation, and operational metrics.

## User and operational problem

A model that performs well in a notebook is not enough for an operational team. The harder questions are:

1. Which exact data and configuration produced the deployed artifact?
2. Can a candidate be compared with production before promotion?
3. Can a bad release be rolled back deterministically?
4. Can events be replayed without double-counting or corrupting state?
5. Can delayed ground truth update calibration metrics without leaking future information into features?
6. Can drift or reliability degradation trigger evidence rather than an opaque automated action?

These systems make those contracts explicit.

## High-value invariants

### ForgeML

- artifacts are versioned and immutable once registered
- lineage includes dataset/config hashes
- lifecycle state transitions are controlled rather than arbitrary
- promotion has an explicit gate
- rollback points to a known prior artifact
- monitoring and retraining recommendations consume persisted evidence

### Falcon

- event identity supports idempotent replay
- Kafka offsets are committed manually after successful handling
- features are computed point-in-time
- delayed labels update monitoring state after decisions are made
- champion/challenger evaluation is separated from promotion
- monitoring exposes calibration, ranking, drift, and service health signals

## Why deterministic control planes matter

LLMs or heuristic assistants can summarize evidence, but promotion, rollback, lineage, replay, and release gates should remain deterministic. An operational control plane must be inspectable and testable even when an optional intelligence layer is unavailable.

## Failure modes considered

- duplicate/replayed events
- out-of-order or delayed labels
- candidate model underperformance
- drift after deployment
- missing artifacts or invalid lifecycle transitions
- non-reproducible training inputs
- API/process restarts
- Kafka consumer failure before offset commit
- stale feature state

## Scale path

At larger scale I would separate API orchestration from model-serving workers, store artifacts in object storage, move registry/state to managed PostgreSQL, partition streaming workloads by entity/tenant, add a feature store or strongly versioned online/offline feature contract, emit OpenTelemetry traces, and run shadow/canary evaluation through a deployment controller.

The repository demonstrates the contracts and failure-handling logic; it does not claim commercial-scale traffic or production deployment.
