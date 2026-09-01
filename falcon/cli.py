from __future__ import annotations

import argparse
import json
from pathlib import Path

import uvicorn

from falcon.bootstrap import bootstrap_demo
from falcon.control import FalconReleaseController
from falcon.monitoring import FalconMonitor
from falcon.retraining import RetrainingAdvisor, retrain_from_feedback
from falcon.storage import DecisionStore
from falcon.streaming import KafkaDecisionWorker


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="falcon", description="Falcon real-time AI decisioning")
    parser.add_argument("--state-dir", default=".falcon_state")
    sub = parser.add_subparsers(dest="command", required=True)

    bootstrap = sub.add_parser("bootstrap")
    bootstrap.add_argument("--rows", type=int, default=1600)

    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="0.0.0.0")
    serve.add_argument("--port", type=int, default=8080)

    worker = sub.add_parser("worker")
    worker.add_argument("--bootstrap-servers", default="localhost:9092")

    experiment = sub.add_parser("experiment")
    experiment.add_argument("--challenger-version", type=int)
    experiment.add_argument("--traffic-percent", type=int, default=0)
    experiment.add_argument("--mode", choices=["shadow", "active"], default="shadow")

    promote = sub.add_parser("promote")
    promote.add_argument("version", type=int)

    rollback = sub.add_parser("rollback")
    rollback.add_argument("version", type=int)

    retrain = sub.add_parser("retrain")
    retrain.add_argument("--min-labels", type=int, default=200)

    sub.add_parser("monitor")
    sub.add_parser("recommend")
    sub.add_parser("status")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    root = Path(args.state_dir)

    if args.command == "bootstrap":
        result = bootstrap_demo(root, rows=args.rows)
    elif args.command == "serve":
        import os
        os.environ["FALCON_STATE_DIR"] = str(root)
        uvicorn.run("falcon.api:app", host=args.host, port=args.port)
        return
    elif args.command == "worker":
        KafkaDecisionWorker(root, bootstrap_servers=args.bootstrap_servers).run_forever()
        return
    elif args.command == "experiment":
        result = FalconReleaseController(root).configure_experiment(
            args.challenger_version, args.traffic_percent, args.mode
        )
    elif args.command == "promote":
        result = FalconReleaseController(root).promote(args.version)
    elif args.command == "rollback":
        result = FalconReleaseController(root).rollback(args.version)
    elif args.command == "retrain":
        result = retrain_from_feedback(root, min_labels=args.min_labels)
    elif args.command == "monitor":
        result = FalconMonitor(root).snapshot()
    elif args.command == "recommend":
        result = RetrainingAdvisor(root).recommend()
    elif args.command == "status":
        store = DecisionStore(root / "falcon.db")
        result = {
            "experiment": store.get_experiment(),
            "recent_decisions": store.recent_decisions(10),
        }
    else:
        raise SystemExit(2)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
