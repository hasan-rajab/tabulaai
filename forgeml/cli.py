from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import uvicorn

from .deployment import DeploymentManager
from .registry import ModelRegistry
from .tracking import ExperimentTracker
from .training import ForgeTrainer


def _components(home: Path):
    return (
        ModelRegistry(home / "registry"),
        ExperimentTracker(home / "experiments.db"),
        DeploymentManager(home / "deployments.db"),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="ForgeML lifecycle CLI")
    parser.add_argument("--home", default=".forgeml", help="ForgeML state directory")
    sub = parser.add_subparsers(dest="command", required=True)

    train = sub.add_parser("train")
    train.add_argument("csv")
    train.add_argument("--target", required=True)
    train.add_argument("--model-name", default="forgeml-model")
    train.add_argument("--task", choices=["classification", "regression"])

    stable = sub.add_parser("deploy")
    stable.add_argument("--model-name", required=True)
    stable.add_argument("--version", type=int, required=True)

    canary = sub.add_parser("canary")
    canary.add_argument("--model-name", required=True)
    canary.add_argument("--version", type=int, required=True)
    canary.add_argument("--fraction", type=float, default=0.10)

    promote = sub.add_parser("promote-canary")
    promote.add_argument("--model-name", required=True)

    rollback = sub.add_parser("rollback")
    rollback.add_argument("--model-name", required=True)

    status = sub.add_parser("status")
    status.add_argument("--model-name", required=True)

    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="0.0.0.0")
    serve.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()
    home = Path(args.home)
    home.mkdir(parents=True, exist_ok=True)
    registry, tracker, deployments = _components(home)

    if args.command == "train":
        df = pd.read_csv(args.csv)
        trainer = ForgeTrainer(
            workdir=home / "work",
            tracker=tracker,
            registry=registry,
        )
        result = trainer.train(
            df,
            target=args.target,
            model_name=args.model_name,
            task=args.task,
        )
    elif args.command == "deploy":
        registry.get(args.model_name, args.version)
        registry.promote(args.model_name, args.version, "production")
        result = deployments.set_stable(args.model_name, args.version)
    elif args.command == "canary":
        registry.get(args.model_name, args.version)
        registry.promote(args.model_name, args.version, "staging")
        result = deployments.start_canary(args.model_name, args.version, args.fraction)
    elif args.command == "promote-canary":
        challenger = deployments.current(args.model_name).get("challenger_version")
        if challenger is None:
            raise SystemExit("No active canary")
        registry.promote(args.model_name, int(challenger), "production")
        result = deployments.promote_canary(args.model_name)
    elif args.command == "rollback":
        result = deployments.rollback(args.model_name)
        registry.promote(args.model_name, int(result["stable_version"]), "production")
    elif args.command == "status":
        result = {
            "deployment": deployments.current(args.model_name),
            "versions": registry.list_versions(args.model_name),
            "runs": tracker.list_runs(args.model_name),
        }
    else:
        import os

        os.environ["FORGEML_HOME"] = str(home)
        uvicorn.run("forgeml.api:app", host=args.host, port=args.port, reload=False)
        return

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
