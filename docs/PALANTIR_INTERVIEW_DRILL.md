# Palantir FDSE Interview Drill — ForgeML + Falcon

Use this repository to prove that you understand the full ML decision lifecycle: data → model → release → real-time decision → feedback → monitoring → retraining → rollback.

## 30-second pitch

ForgeML and Falcon are two connected production-style systems. ForgeML is the release/control plane: data validation, lineage, experiment tracking, immutable model versions, canaries, drift monitoring and rollback. Falcon is the online workload: Kafka transaction events, point-in-time features, champion/challenger scoring, governed decisions, delayed labels and monitoring. The design keeps probabilistic model outputs separate from deterministic release and policy controls.

## Hostile questions and defensible answers

### Why build your own mini registry instead of MLflow?
The project is not claiming to replace MLflow. Implementing a small registry makes lifecycle invariants explicit and inspectable: immutable versions, stages, artifact identity and promotion/rollback. In a real customer environment I would usually integrate with an existing managed registry unless requirements justify custom infrastructure.

### Why deterministic canary routing?
Hashing a stable request/transaction ID gives sticky assignment: the same ID routes consistently rather than moving between variants on retry. That makes comparisons easier to reason about and avoids random assignment changing behavior for the same entity.

### Why separate monitoring from deployment?
Drift or degraded metrics are evidence, not permission to change production. Monitoring can recommend retraining and create a candidate, but promotion remains an explicit control-plane action. This prevents an automated feedback loop from silently deploying a bad model.

### Why Kafka?
The decision workload is event-shaped and benefits from buffering, replay and decoupled producers/consumers. The worker waits for the output event acknowledgement before committing the corresponding source offset, making failure/replay semantics explicit.

### Are Kafka commits precise across partitions?
Yes. The worker commits the exact source `TopicPartition` at `message.offset + 1` after the output send is acknowledged. It does not call an unscoped commit that could advance another assigned partition's current position.

### Is Falcon truly idempotent?
Within the single-process SQLite reference runtime, the decision engine serializes the idempotency check, point-in-time feature read, decision persistence and history update under a process-local lock. Repeated transaction IDs return the persisted decision. For a multi-process/distributed deployment, that invariant must move into a transactional external store or compare-and-set/idempotency-key mechanism; the process lock is not presented as distributed coordination.

### Why record the transaction after scoring?
Velocity, novelty and behavioral features must use only history strictly older than the current event. Recording before feature construction would leak the event into its own features. The order is therefore feature read → score/decision → persist decision → record event.

### Why XGBoost plus an autoencoder?
They capture different information: supervised fraud/risk patterns and unsupervised novelty. Their outputs are combined through an explicit policy rather than treated as interchangeable probabilities. The point is complementary evidence and controlled decisioning.

### Why Brier score and ROC-AUC?
ROC-AUC measures ranking discrimination; Brier score measures probability calibration/error. A model can rank well and still produce poorly calibrated scores, which matters when policy thresholds determine customer-facing actions.

### What happens if labels arrive days later?
Falcon stores decisions/features and later joins delayed feedback by transaction ID. Model comparison and retraining use labeled rows once outcomes arrive. This reflects the real operational gap between online decisions and later ground truth.

### What would break at 100k events/second?
SQLite, process-local coordination, synchronous Python model serving and a single worker would be the first obvious constraints. I would partition by a stable entity key where point-in-time feature locality permits, move state to a scalable transactional/feature store, use a model-serving tier sized from measured latency/throughput, define exactly which events need durable output, and benchmark end-to-end lag rather than scaling components blindly.

### What if the challenger is better on AUC but causes more manual reviews?
The promotion objective must include business cost, not just model metrics. I would compare calibration, decision distribution, review capacity, false-positive cost and segment-level behavior against customer-agreed acceptance criteria before promotion.

### Why explicit rollback instead of retraining the old model?
Rollback is an operational recovery action. If a known-good immutable artifact exists, restoring it should not depend on a new training job or mutable training data. Retraining and rollback solve different problems.

### What is the weakest evidence?
The workload and training data are synthetic/portfolio scale. The repository demonstrates lifecycle correctness and systems reasoning, not real payment-fraud efficacy or production scale. Real deployment requires externally representative data, privacy/compliance review, load tests, durable distributed infrastructure and business-defined thresholds.

## Code anchors

- `forgeml/registry.py` — immutable model/version lifecycle
- `forgeml/deployment.py` — canary routing, promotion and rollback
- `forgeml/monitoring.py` — drift/performance evidence
- `falcon/features.py` — point-in-time feature construction
- `falcon/decision.py` — idempotency, champion/challenger selection and policy
- `falcon/streaming.py` — Kafka acknowledgement/offset semantics
- `falcon/storage.py` — durable local decision/feedback ledger
- `tests/test_falcon_decisioning.py` — end-to-end decision invariants
- `tests/test_falcon_streaming_offsets.py` — exact offset-commit regression
- `docs/ENGINEERING_NOTES.md` — system-wide tradeoffs and scale path

## Claims boundary

Do not claim a commercial fraud deployment, distributed exactly-once semantics, production-scale throughput or that the local registry replaces mature MLOps platforms. Claim explicit lifecycle/control-plane engineering, point-in-time feature discipline, idempotent local decisioning, partition-scoped Kafka commits, delayed-label evaluation and reproducible release/rollback behavior.
