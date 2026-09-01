from __future__ import annotations

from pathlib import Path
from typing import Any

from falcon.control import FalconReleaseController
from falcon.training import train_and_register
from forgeml.registry import ModelRegistry


def bootstrap_demo(state_dir: str | Path, *, rows: int = 1600) -> dict[str, Any]:
    """Create a deterministic champion/challenger pair for local demonstrations."""
    root = Path(state_dir)
    registry = ModelRegistry(root / "registry")
    try:
        production = registry.resolve("falcon-risk", "production")
        versions = registry.list_versions("falcon-risk")
        challenger = next((item for item in versions if item["stage"] in {"staging", "candidate"}), None)
        return {"production": production, "challenger": challenger, "created": False}
    except KeyError:
        pass

    champion = train_and_register(root, n=rows, seed=42, challenger=False, stage="candidate")
    registry.promote("falcon-risk", int(champion["version"]), "production")
    challenger = train_and_register(root, n=rows, seed=84, challenger=True, stage="staging")
    FalconReleaseController(root).configure_experiment(int(challenger["version"]), 20, "shadow")
    return {
        "production": registry.resolve("falcon-risk", "production"),
        "challenger": challenger,
        "created": True,
    }
